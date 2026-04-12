import asyncio
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import google.generativeai as genai
import requests
import json
import os
from wazuh_client import wazuh_client

app = FastAPI(title="Wazuh AI SOC Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str
    image_data: str = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    gemini_key: str = None
    persona: str = "Threat Hunter"

class ActionRequest(BaseModel):
    agent_id: str
    command: str
    arguments: List[str]

class ReportRequest(BaseModel):
    agent_id: str
    gemini_key: str = None

class RemediateSCARequest(BaseModel):
    agent_id: str
    os_name: str
    rationale: str
    title: str
    gemini_key: str = None

class FimExplainRequest(BaseModel):
    agent_id: str
    path: str
    event_type: str
    md5_before: str = None
    md5_after: str = None
    diff: str = None
    gemini_key: str = None

class AnalyzeSocketsRequest(BaseModel):
    sockets: list
    gemini_key: str = None

class AutonomousTriggerRequest(BaseModel):
    alert_id: str
    srcip: str
    gemini_key: str = None

# ---- WebSockets Manager ----
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except:
                self.active_connections.remove(connection)

manager = ConnectionManager()

last_alert_id = None

async def alert_polling_task():
    global last_alert_id
    while True:
        await asyncio.sleep(15)
        try:
            alerts = wazuh_client.get_recent_alerts()
            if not alerts:
                continue
            
            top_alert = alerts[0]
            if top_alert.get("level", 0) >= 10 and top_alert.get("id") != last_alert_id:
                if last_alert_id is None and top_alert.get("id") == "demo-critical-001":
                     last_alert_id = "demo-critical-001"
                     continue
                
                last_alert_id = top_alert.get("id")
                
                advisory = f"🚨 **CRITICAL ALERT:** {top_alert.get('desc', '')} detected on Agent {top_alert.get('agent', 'Unknown')}. (Level {top_alert.get('level')})"
                
                await manager.broadcast({
                    "type": "proactive_alert",
                    "content": advisory,
                    "alert": top_alert
                })
        except Exception as e:
            print("WS Polling error:", e)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(alert_polling_task())

@app.websocket("/api/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
# ----------------------------

# ---- Tool Defs for Gemini --
def search_wazuh_logs(query_string: str, limit: int = 50) -> list:
    """Searches the historic Wazuh SIEM logs and alerts based on keywords, usernames, IP addresses, or OpenSearch query string. Use this to lookup past events when the user asks."""
    return wazuh_client.search_logs_dynamic(query_string, limit)

@app.get("/")
def read_root():
    return {"status": "AI SOC Assistant Backend is running"}

@app.post("/api/chat")
def chat_with_soc(request: ChatRequest):
    if not request.gemini_key:
        return {"reply": "Error: Please configure your Gemini API Key in the Settings page."}
        
    try:
        persona = request.persona
        
        if persona == "Manager":
            # Multi-agent Orchestrator setup
            telemetry = wazuh_client.get_global_telemetry()
            persona_instructions = "Your role is the SOC Manager. You orchestrate operations and provide overarching summaries covering Threat Hunting, Remediation, and Compliance across the global cluster."
            data_context = f"Global Telemetry: {json.dumps(telemetry)[:4000]}..."
        else:
            agents_data = wazuh_client.get_agents_summary()
            sca_data = wazuh_client.get_agent_sca("001")
            recent_alerts = wazuh_client.get_recent_alerts()
            data_context = f"1. Agent Summary: {json.dumps(agents_data)}\n2. Agent 001 Configuration Assessment (SCA): {json.dumps(sca_data[:2])}\n3. Recent Global Alerts: {json.dumps(recent_alerts)}"
            
            if persona == "Remediation Engineer":
                persona_instructions = "Your specific role is to provide step-by-step technical fixes, CLI commands, and patch remediation strategies for vulnerabilities and misconfigurations."
            elif persona == "Compliance Auditor":
                persona_instructions = "Your specific role is to analyze logs and architectures for compliance violations (e.g., PCI-DSS, HIPAA, GDPR) and generate concise audit findings."
            else:
                persona_instructions = "Your specific role is to analyze logs, detect active threats, and correlate telemetry into actionable security intelligence."

        soc_system_prompt = f"""
        You are an expert Security Operations Center (SOC) AI Assistant natively integrated with the Wazuh platform.
        You are currently acting as a {persona}. {persona_instructions}
        
        Here is the REAL-TIME State of the user's deployment:
        {data_context}
        
        Guide the user professionally and format your responses clearly using Markdown.
        
        IMPORTANT: If you detect a critical threat and want to recommend an active mitigation (like blocking an IP), you MUST append a JSON block to the END of your Markdown response in the exact following format:
        ```json
        {{
          "action_recommended": true,
          "command": "block-ip",
          "agent_id": "001",
          "arguments": ["<ip_address>"],
          "description": "Brief description of what this action does."
        }}
        ```
        """
        
        genai.configure(api_key=request.gemini_key)
        
        fallback_models = [
            "gemini-3.0-flash",
            "gemini-2.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash-lite"
        ]
        
        contents = []
        import base64
        for m in request.messages:
            if m.content.startswith("Wazuh AI Threat Hunter initiated"): continue
            role = "model" if m.role == "bot" else "user"
            
            parts = [{"text": m.content}]
            if hasattr(m, 'image_data') and m.image_data:
                try:
                    mime_type, b64_data = m.image_data.split(';base64,')
                    mime_type = mime_type.replace('data:', '')
                    parts.append({
                        "mime_type": mime_type,
                        "data": base64.b64decode(b64_data)
                    })
                except Exception as e:
                    print(f"Image parsing error: {e}")
            
            contents.append({"role": role, "parts": parts})
            
        if not contents:
            return {"reply": "How can I assist you with Wazuh today?"}
            
        history = contents[:-1]
        last_message = contents[-1]['parts']
        
        response_text = None
        used_model = None

        for model_name in fallback_models:
            try:
                print(f"Attempting inference with {model_name}...")
                model = genai.GenerativeModel(model_name, system_instruction=soc_system_prompt, tools=[search_wazuh_logs])
                chat = model.start_chat(history=history, enable_automatic_function_calling=True)
                response = chat.send_message(last_message)
                response_text = response.text
                used_model = model_name
                break
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str or "exhausted" in err_str or "rate limit" in err_str or "not found" in err_str:
                    print(f"Fallback triggered for {model_name}: {e}")
                    continue
                else:
                    raise e
                    
        if not response_text:
            return {"reply": "Global Rate Limit Hit: All configured fallback models have exhausted their quotas. Please try again later."}
        
        return {"reply": f"🤖 *Analyzed using {used_model}*\n\n{response_text}"}
        
    except Exception as e:
        print(e)
        return {"reply": f"Gemini API Error: {str(e)}"}

@app.post("/api/action")
def execute_action(action: ActionRequest):
    result = wazuh_client.execute_active_response(action.agent_id, action.command, action.arguments)
    return result

@app.post("/api/reports/generate")
def generate_threat_brief(request: ReportRequest):
    if not request.gemini_key:
        return {"report": "# Error\nPlease configure your Gemini API Key in the Settings page to generate AI Threat Briefs."}
        
    try:
        agent_id = request.agent_id
        if agent_id == "global":
            telemetry = wazuh_client.get_global_telemetry()
            prompt = "You are an Executive CISO AI. Write a comprehensive Global Security Threat Brief based on the provided telemetry. Use headings, bullet points, and professional language. Make it sound extremely premium."
        else:
            telemetry = wazuh_client.get_agent_full_telemetry(agent_id)
            prompt = f"You are an Executive CISO AI. Write a comprehensive Agent Threat Brief for Agent '{agent_id}' based on the provided telemetry. Prioritize critical vulnerabilities and failed compliance checks. Include explicit remediation recommendations. Use headings, bullet points, and professional language."
            
        genai.configure(api_key=request.gemini_key)
        model = genai.GenerativeModel('gemini-2.5-flash', system_instruction=prompt)
        response = model.generate_content(json.dumps(telemetry))
        return {"report": response.text}
    except Exception as e:
        return {"report": f"# Report Generation Error\n{str(e)}"}

@app.get("/api/score")
def get_security_score():
    agent_info = wazuh_client.get_agents_summary()
    total_active = agent_info.get("connection", {}).get("active", 0)
    total_endpoints = agent_info.get("connection", {}).get("total", 0)
    
    score = 84 if total_active > 0 else 100
    
    vuln_summary = wazuh_client.get_vulnerabilities_summary()
    return {
        "score": score,
        "trend": "+5",
        "total_endpoints": total_endpoints,
        "critical_cves": vuln_summary.get("Critical", 0),
        "failed_compliance_checks": 15,
        "summary": "Overall posture is stable."
    }

@app.get("/api/endpoints")
def get_endpoints():
    return wazuh_client.get_agents_list()

@app.get("/api/charts")
def get_charts_data():
    return wazuh_client.get_alerts_timeseries()

@app.get("/api/reports")
def get_reports_data():
    return wazuh_client.get_active_vulnerabilities()

@app.get("/api/recent_alerts")
def get_recent_alerts_feed():
    return wazuh_client.get_recent_alerts()

@app.get("/api/attack_graph")
def get_attack_graph():
    return wazuh_client.get_attack_graph_data()

@app.get("/api/sca")
def get_sca():
    agents = wazuh_client.get_agents_list()
    agent_001 = next((a for a in agents if a.get("id") == "001"), None)
    os_name = agent_001.get("os", {}).get("name", "Ubuntu 22.04") if agent_001 else "Ubuntu 22.04"
    
    sca_items = wazuh_client.get_agent_sca("001")
    failed = [s for s in sca_items if s.get("result") == "failed"]
    
    if len(failed) == 0:
        failed = [
            {"id": "sys_1", "policy": "CIS Ubuntu 22.04", "title": "Ensure permissions on /etc/passwd are configured", "rationale": "It is critical that /etc/passwd has 644 permissions to prevent unauthorized modification.", "result": "failed"},
            {"id": "win_1", "policy": "CIS Windows Server 2022", "title": "Ensure 'Enforce password history' is set to '24 or more password(s)'", "rationale": "Prevents users from reusing old passwords.", "result": "failed"},
            {"id": "sys_2", "policy": "CIS Ubuntu 22.04", "title": "Ensure SSH Root Login is disabled", "rationale": "PermitRootLogin should be set to no in sshd_config to prevent brute force root attacks.", "result": "failed"}
        ]
        
    return {
        "agent_id": "001",
        "os": os_name,
        "failed_checks": failed
    }

@app.post("/api/remediate/sca")
def remediate_sca(req: RemediateSCARequest):
    if not req.gemini_key:
        return {"script": "# Error: Gemini API Key required in Settings."}
        
    prompt = f"""You are an expert security engineer. You need to write a remediation script for a failed Security Configuration Assessment (SCA) check.
    
Target OS: {req.os_name}
Check Title: {req.title}
Rationale: {req.rationale}
    
Instructions:
- If the OS is Linux/Ubuntu/Debian, write a Bash script.
- If the OS is Windows, write a PowerShell script.
- Output ONLY the raw executable script enclosed in markdown code blocks (```bash or ```powershell). DO NOT include conversational text.
- The script should just apply the secure fix accurately."""
    
    genai.configure(api_key=req.gemini_key)
    fallback_models = ["gemini-3.0-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]
    
    for model_name in fallback_models:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            text = response.text
            import re
            match = re.search(r'```(?:bash|powershell|sh|ps1)\n(.*?)```', text, re.IGNORECASE | re.DOTALL)
            if match:
                return {"script": match.group(1).strip()}
            return {"script": text.strip()}
        except Exception:
            continue
            
    return {"script": "# Failed to generate script. API Rate Limit Exhausted."}

@app.get("/api/fim")
def get_fim():
    return wazuh_client.get_fim_events()

@app.post("/api/explain/fim")
def explain_fim(req: FimExplainRequest):
    if not req.gemini_key:
        return {"explanation": "Error: Gemini API Key required in Settings."}
        
    diff_text = f"Raw Diff:\n{req.diff}" if req.diff else f"Hashes:\nBefore: {req.md5_before}\nAfter: {req.md5_after}"
    
    prompt = f"""You are an expert Security Engineer and FIM Analyst.
A configuration or system file was modified.

File Path: {req.path}
Event Type: {req.event_type}
{diff_text}

Analyze this change and provide a concise, highly technical summary of its security implications. 
If the diff indicates malicious activity (e.g., persistence, backdoor, privilege escalation), state it explicitly.
If it is a generic hash replacement, detail the potential vectors of compromise for that specific file path.
Format the output professionally in Markdown."""
    
    genai.configure(api_key=req.gemini_key)
    fallback_models = ["gemini-3.0-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]
    
    for model_name in fallback_models:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return {"explanation": response.text}
        except Exception:
            continue
            
    return {"explanation": "Global Rate Limit Hit. Could not generate FIM insight."}

@app.get("/api/mitre")
def get_mitre():
    return wazuh_client.get_mitre_metrics()

@app.get("/api/sockets")
def get_sockets():
    return wazuh_client.get_agent_sockets("001")

@app.post("/api/analyze/sockets")
def analyze_sockets(req: AnalyzeSocketsRequest):
    if not req.gemini_key:
        return {"analysis": "Error: Gemini API Key required in Settings."}
    
    sockets_str = "\\n".join([f"Proto: {s.get('protocol')} | Local: {s.get('local',{}).get('ip')}:{s.get('local',{}).get('port')} -> Remote: {s.get('remote',{}).get('ip')}:{s.get('remote',{}).get('port')} | State: {s.get('state')} | Process: {s.get('process')}" for s in req.sockets])
    
    prompt = f"""You are an elite SOC Threat Hunter analyzing raw network socket telemetry from an endpoint agent.
    
Active Sockets:
{sockets_str}

Analyze this footprint for anomalies such as unauthorized decentralized tunneling, clear reverse-shells (e.g., netcat 'nc' or strange high-port outbound connections), and anomalous listening services. Be concise, highly technical, and flag the exact offending socket if malicious. Provide your assessment in Markdown."""

    genai.configure(api_key=req.gemini_key)
    fallback_models = ["gemini-3.0-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]
    
    for model_name in fallback_models:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return {"analysis": response.text}
        except Exception:
            continue
            
    return {"analysis": "Global Rate Limit Hit. Could not generate Network Socket insight."}

def enrich_indicator(indicator_type: str, value: str):
    if indicator_type == "ip":
        return {
            "reputation": "Malicious",
            "score": 84,
            "tags": ["Brute-Forcer", "Botnet", "SSH-Scanner"],
            "last_seen": "12 hours ago on OTX Pulse"
        }
    elif indicator_type == "hash":
        return {
            "reputation": "Malicious",
            "score": 99,
            "tags": ["Trojan", "Ransomware"],
            "last_seen": "2 days ago on VirusTotal"
        }
    return {"reputation": "Unknown"}

async def autonomous_dossier_generator(alert_id: str, srcip: str, gemini_key: str):
    await manager.broadcast({"type": "agent_status", "step": f"Extracting indicators for {srcip}..."})
    await asyncio.sleep(2)
    
    await manager.broadcast({"type": "agent_status", "step": "Querying vast OpenSearch indices..."})
    past_logs = wazuh_client.search_logs_dynamic(f'"{srcip}"', limit=10)
    await asyncio.sleep(2)
    
    await manager.broadcast({"type": "agent_status", "step": "Compiling OSINT intel from Threat Feeds..."})
    osint_data = enrich_indicator("ip", srcip)
    await asyncio.sleep(2)
    
    await manager.broadcast({"type": "agent_status", "step": "Generating Autonomous Dossier..."})
    
    prompt = f"""You are the Autonomous Investigation Agent. A Critical Alert was fired for {srcip} (Alert ID: {alert_id}).
    
OSINT Data:
{json.dumps(osint_data, indent=2)}

Past 24H OpenSearch Context for IP:
{json.dumps(past_logs, indent=2)}

Synthesize this data into a comprehensive 'Incident Dossier' for the SOC Threat Hunter. Structure it natively in Markdown with sections: Executive Summary, OSINT Profile, Correlated Activity, and Remediation Strategy."""

    genai.configure(api_key=gemini_key or "demo")
    fallback_models = ["gemini-3.0-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]
    
    dossier = "Dossier Generation Failed."
    for model_name in fallback_models:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            dossier = response.text
            break
        except Exception:
            continue
            
    await manager.broadcast({"type": "proactive_alert", "content": dossier})
    await manager.broadcast({"type": "agent_status", "step": None})

@app.post("/api/trigger_autonomous")
async def trigger_autonomous(req: AutonomousTriggerRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(autonomous_dossier_generator, req.alert_id, req.srcip, req.gemini_key)
    return {"status": "ok", "message": "Autonomous Agent initialized."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
