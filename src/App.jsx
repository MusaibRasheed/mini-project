import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Configure API base URL based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8000'
    : ''
);

// Helper function to make API calls with proper base URL
const apiCall = (method, endpoint, data = null) => {
  const url = `${API_BASE_URL}${endpoint}`;
  if (method.toLowerCase() === 'get') {
    return axios.get(url);
  } else if (method.toLowerCase() === 'post') {
    return axios.post(url, data);
  }
  return Promise.reject(new Error('Unsupported method'));
};
import { 
  Search, Shield, Activity, Terminal, CheckCircle2, AlertTriangle, 
  Settings, Users, Box, Zap, ArrowUpRight, ArrowDownRight,
  Bell, ChevronRight, Send, HelpCircle, FileText, MousePointer2, Save, X, Paperclip
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Legend, BarChart, Bar
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReactFlow, Controls, Background, applyNodeChanges, applyEdgeChanges, MarkerType, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Sphere, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [apiKey, setApiKey] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [aiPersona, setAiPersona] = useState('Threat Hunter');
  const [proactiveAlert, setProactiveAlert] = useState(null);
  const [agentStatus, setAgentStatus] = useState(null);
  const [scoreData, setScoreData] = useState({
      score: 84,
      trend: "+5",
      total_endpoints: 124,
      critical_cves: 3,
      failed_compliance_checks: 15,
      avg_resolution_time: "14m"
  });

  // Global WebSocket for proactive alerts
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket('/api/ws/alerts');
      
      ws.onmessage = (event) => {
         try {
             const data = JSON.parse(event.data);
             if (data.type === 'proactive_alert') {
                 setProactiveAlert(data);
                 // Append to standard chat history
                 const saved = localStorage.getItem('chat_history');
                 const history = saved ? JSON.parse(saved) : [];
                 const newMsg = {role: 'bot', content: data.content};
                 localStorage.setItem('chat_history', JSON.stringify([...history, newMsg]));
                 
                 // Auto hide toast after 8 seconds
                 setTimeout(() => setProactiveAlert(null), 8000);
             } else if (data.type === 'agent_status') {
                 setAgentStatus(data.step);
             }
         } catch (e) {
           console.debug('WebSocket message parse error:', e);
         }
      };
      
      ws.onerror = (error) => {
        console.debug('WebSocket connection error (backend may not be running):', error);
      };
      
      ws.onclose = () => {
        console.debug('WebSocket connection closed');
      };
    } catch (e) {
      console.debug('WebSocket initialization error:', e);
    }
    
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Fetch actual wazuh live stats from FastAPI layer
  useEffect(() => {
    axios.get('/api/score')
      .then(res => setScoreData(prev => ({...prev, ...res.data})))
      .catch(err => console.error("Could not reach backend /api/score:", err));
  }, [activeTab]); // Refetch when changing tabs

  // Load API key from local storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  return (
    <div className="app-layout" style={{ background: 'radial-gradient(circle at center, #0a0a1a 0%, #1a0033 50%, #000 100%)' }}>
      <CyberBackground3D />
      <div className="scanline-overlay"></div>
      {/* SIDEBAR - EXACT REPLICA OF THE IMAGE */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{background: 'var(--primary-blue)', padding: '6px', borderRadius: '8px', display: 'flex'}}>
            <Shield size={20} color="white" />
          </div>
          Wazuh AI X
        </div>

        <div className="sidebar-search">
          <Search size={16} />
          <input type="text" placeholder="Search resources..." />
        </div>

        <div className="nav-section">
          <div className={`nav-item ${activeTab === 'Home' ? 'active' : ''}`} onClick={() => setActiveTab('Home')}>
            <Activity size={18} /> <span>Home</span>
            <ChevronRight size={16} style={{marginLeft: 'auto'}} />
          </div>
          
          <div style={{ marginLeft: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px', marginTop: '4px', marginBottom: '16px' }}>
             <div className="nav-section-title" style={{textTransform: 'none', color: 'var(--text-muted)'}}>All pages</div>
             <div className={`nav-item ${activeTab === 'Reports' ? 'active' : ''}`} onClick={() => setActiveTab('Reports')} style={{fontWeight: 400}}>
                Security Reports
             </div>
             <div className={`nav-item ${activeTab === 'Endpoints' ? 'active' : ''}`} onClick={() => setActiveTab('Endpoints')} style={{fontWeight: 400}}>
                Endpoints
             </div>
             <div className={`nav-item ${activeTab === 'AITask' ? 'active' : ''}`} onClick={() => setActiveTab('AITask')} style={{fontWeight: 400}}>
                AI Threat Hunter
             </div>
             <div className={`nav-item ${activeTab === 'AttackPath' ? 'active' : ''}`} onClick={() => setActiveTab('AttackPath')} style={{fontWeight: 400}}>
                Attack Graph
             </div>
             <div className={`nav-item ${activeTab === 'MitreMatrix' ? 'active' : ''}`} onClick={() => setActiveTab('MitreMatrix')} style={{fontWeight: 400}}>
                MITRE Heatmap
             </div>
             <div className={`nav-item ${activeTab === 'NetworkSockets' ? 'active' : ''}`} onClick={() => setActiveTab('NetworkSockets')} style={{fontWeight: 400}}>
                Network Sockets
             </div>
          </div>

          <div className={`nav-item ${activeTab === 'Settings' ? 'active' : ''}`} onClick={() => setActiveTab('Settings')}>
            <Settings size={18} /> <span>Settings</span> <ChevronRight size={16} style={{marginLeft: 'auto'}} />
          </div>
        </div>


      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-area">
        <header className="top-header">
          <div className="breadcrumb">
            Dashboard &rsaquo; <span style={{color: 'var(--text-active)'}}>{activeTab === 'AITask' ? 'AI Threat Hunter' : activeTab}</span>
          </div>
          <div className="header-actions">
          </div>
        </header>

        {activeTab === 'Home' ? (
          <DashboardView data={scoreData} />
        ) : activeTab === 'Reports' ? (
          <SecurityReportsView setAiContext={setAiContext} setActiveTab={setActiveTab} />
        ) : activeTab === 'Endpoints' ? (
          <EndpointsView />
        ) : activeTab === 'AITask' ? (
          <AITaskView apiKey={apiKey} aiContext={aiContext} setAiContext={setAiContext} aiPersona={aiPersona} setAiPersona={setAiPersona} agentStatus={agentStatus} />
        ) : activeTab === 'AttackPath' ? (
          <AttackGraphView />
        ) : activeTab === 'MitreMatrix' ? (
          <MitreMatrixView />
        ) : activeTab === 'NetworkSockets' ? (
          <NetworkActivityView />
        ) : activeTab === 'Settings' ? (
          <SettingsView apiKey={apiKey} setApiKey={setApiKey} />
        ) : (
          <MockupView title="Page Under Construction" desc="This module is yet to be implemented." />
        )}
        
        {/* Proactive Alert Global Toast */}
        {proactiveAlert && (
           <div style={{position: 'fixed', bottom: '30px', right: '30px', background: 'var(--bg-card)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 9999, maxWidth: '400px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                 <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontWeight: 'bold'}}><AlertTriangle size={18}/> PROACTIVE ALERT</div>
                 <button onClick={() => setProactiveAlert(null)} style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'}}><X size={16}/></button>
              </div>
              <div style={{fontSize: '0.9rem', color: 'var(--text-active)', marginBottom: '12px'}}><ReactMarkdown>{proactiveAlert.content}</ReactMarkdown></div>
              <button className="primary-btn" onClick={() => { setActiveTab('AITask'); setProactiveAlert(null); }}>Investigate in AI Chat</button>
           </div>
        )}
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------------
// DASHBOARD VIEW
// -----------------------------------------------------------------------------------
function DashboardView({ data }) {
  const [fullData, setFullData] = useState([]);
  const [timeFilter, setTimeFilter] = useState('Month');
  const [introFinished, setIntroFinished] = useState(false);
  
  useEffect(() => {
    setTimeout(() => setIntroFinished(true), 2500);
  }, []);

  useEffect(() => {
    axios.get('/api/charts')
      .then(res => {
         if (res.data && res.data.length > 0) {
             setFullData(res.data);
         }
      })
      .catch(err => console.error("Charts fetch error", err));
  }, []);

  const getFilteredData = () => {
    if (timeFilter === 'Day') return fullData.slice(-1);
    if (timeFilter === 'Week') return fullData.slice(-7);
    if (timeFilter === 'Month') return fullData.slice(-30);
    return fullData;
  };
  
  const areaData = getFilteredData();
  const barData = getFilteredData();

  const radialData = [
    { name: 'Windows', uv: data.total_endpoints - 1 > 0 ? (data.total_endpoints - 1) : 124, fill: '#3b82f6' },
    { name: 'Linux', uv: 1, fill: '#1d4ed8' },
    { name: 'macOS', uv: 0, fill: '#1e3a8a' },
  ];

  return (
    <div className={`dashboard-content ${introFinished ? 'animate-fly-in' : 'opacity-0'}`} style={{ position: 'relative', zIndex: 1, opacity: introFinished ? 1 : 0, transition: 'opacity 0.5s ease' }}>
      {!introFinished && (
         <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'var(--bg-main)', zIndex: 10000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', animation: 'fadeOut 0.5s ease 2s forwards', backdropFilter: 'blur(20px)' }}>
            <h1 style={{ color: 'var(--primary-blue)', fontSize: '5rem', textShadow: '0 0 30px var(--primary-blue), 0 0 10px rgba(255,255,255,0.5)', fontFamily: "'Orbitron', 'JetBrains Mono', monospace", letterSpacing: '8px', textAlign: 'center', margin: 0, animation: 'glitchText 0.3s infinite alternate' }}>WAZUH AI</h1>
            <h2 style={{ color: 'var(--success)', fontSize: '2.5rem', letterSpacing: '12px', marginTop: '10px', textShadow: '0 0 15px var(--success)', fontWeight: 300 }}>THREAT HUNTER</h2>
            <div style={{ marginTop: '50px', display: 'flex', gap: '8px' }}>
                <span className="pill success" style={{ animation: 'pulse 1s infinite' }}>INITIALIZING NEURAL LINK...</span>
            </div>
         </div>
      )}
      {/* Hero 3D Globe + Top 4 Metrics Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '28px', transform: introFinished ? 'translateY(0)' : 'translateY(50px)', transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.1s' }}>
         <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '340px', background: 'radial-gradient(circle at center, rgba(12, 74, 107, 0.2) 0%, rgba(0,0,0,0.4) 100%)' }}>
            <div style={{ padding: '24px 28px 0 28px', position: 'relative', zIndex: 10 }}>
               <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 10px var(--danger)', animation: 'pulse 1.5s infinite' }}></div> Live Global Threat Map</h3>
               <p className="card-subtitle">Active APT telemetry</p>
            </div>
            <div style={{ flex: 1, position: 'relative', marginTop: '-20px' }}>
               <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
                     <ambientLight intensity={1} />
                     <pointLight position={[10, 10, 10]} intensity={2} color="#3b82f6" />
                     <ActiveThreatGlobe />
                  </Canvas>
               </div>
            </div>
         </div>

      {/* Top 4 Metrics Card */}
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Security Operations Analytics</h3>
            <p className="card-subtitle">Analytics report from last 30 days</p>
          </div>
          <div style={{display: 'flex', gap: '8px'}}>
             <span className="pill">All alerts <ChevronRight size={14}/></span>
             <span className="pill">30 Days <ChevronRight size={14}/></span>
          </div>
        </div>

        <div className="stats-grid" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <div className="stat-item">
            <h2>{data.score}/100 <span className="pill success"><ArrowUpRight size={12}/> 12.6%</span></h2>
            <div className="stat-label"><Activity size={16}/> Security Score</div>
          </div>
          <div className="stat-item">
            <h2>{data.total_endpoints} <span className="pill danger"><ArrowDownRight size={12}/> 2.4%</span></h2>
            <div className="stat-label"><Users size={16}/> Active Agents</div>
          </div>
          <div className="stat-item">
            <h2>{data.critical_cves} <span className="pill success"><ArrowUpRight size={12}/> 4.8%</span></h2>
            <div className="stat-label"><AlertTriangle size={16}/> Critical CVEs</div>
          </div>
          <div className="stat-item">
            <h2>{data.avg_resolution_time} <span className="pill success"><ArrowUpRight size={12}/> 10.2%</span></h2>
            <div className="stat-label"><CheckCircle2 size={16}/> Avg Resolution Time</div>
          </div>
        </div>
      </div>
      </div>

      {/* Live Threat Feed (Replaced Area Chart) */}
      <LiveThreatFeed />

      {/* Bottom Grid */}
      <div className="bottom-grid">
         {/* Radial Chart */}
         <div className="card">
            <div className="card-header">
               <h3 className="card-title">Agents by OS</h3>
               <span className="pill">All platforms <ChevronRight size={14}/></span>
            </div>
            <div className="radial-center">
               <h2>{data.total_endpoints}</h2>
               <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={20} data={radialData}>
                  <RadialBar
                    minAngle={15}
                    background={{ fill: 'var(--bg-sidebar)' }}
                    clockWise
                    dataKey="uv"
                    cornerRadius={10}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Bar Chart */}
         <div className="card">
            <div className="card-header">
               <div>
                  <h3 className="card-title">Alert Categories</h3>
                  <p className="card-subtitle" style={{marginTop: '8px'}}>
                     <span style={{color: 'var(--primary-blue)', display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-blue)', marginRight: '6px'}}></span> Malware
                     <span style={{color: 'var(--text-muted)', display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#64748b', marginLeft: '16px', marginRight: '6px'}}></span> Auth Failures
                  </p>
               </div>
               <span className="pill">Week <ChevronRight size={14}/></span>
            </div>
            <div className="chart-container" style={{height: '250px'}}>
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barSize={12}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                     <XAxis dataKey="name" stroke="var(--border-color)" tick={{fill: 'var(--text-muted)'}} />
                     <YAxis stroke="var(--border-color)" tick={{fill: 'var(--text-muted)'}} />
                     <Tooltip cursor={{fill: 'var(--bg-sidebar)'}} contentStyle={{backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px'}} />
                     <Bar dataKey="malware" fill="var(--primary-blue)" radius={[4,4,0,0]} />
                     <Bar dataKey="auth" fill="#64748b" radius={[4,4,0,0]} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------------
// AI THREAT HUNTER VIEW
// -----------------------------------------------------------------------------------
function parseMessageContent(content) {
  try {
    if (content.includes('```json')) {
      const parts = content.split('```json');
      const textPart = parts[0];
      const rest = parts[1].split('```');
      const jsonStr = rest[0];
      const data = JSON.parse(jsonStr);
      if (data.action_recommended) {
        return { text: textPart + (rest[1] || ''), action: data };
      }
    }
  } catch(e) {}
  return { text: content, action: null };
}

// -----------------------------------------------------------------------------------
// AI TASK VIEW (Threat Hunter)
// -----------------------------------------------------------------------------------
function AITaskView({ apiKey, aiContext, setAiContext, aiPersona, setAiPersona, agentStatus }) {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [
      { role: 'bot', content: 'Wazuh AI Threat Hunter initiated. Send natural language queries to search through OpenSearch logs, or ask for endpoint analysis compliance reports. (Powered by Gemini 2.5)' }
    ];
  });
  
  const [chatInput, setChatInput] = useState(aiContext || '');
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setAttachment(reader.result);
          };
          reader.readAsDataURL(file);
      }
      e.target.value = null;
  };

  // Poll LocalStorage in case WS pushed a message while this component was mounted
  // Since WS is in App context making localStorage changes, we periodically check it
  useEffect(() => {
    const interval = setInterval(() => {
       const saved = localStorage.getItem('chat_history');
       if (saved) {
           const parsed = JSON.parse(saved);
           if (parsed.length > messages.length) {
               setMessages(parsed);
           }
       }
    }, 1000);
    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
     if (aiContext) {
        setChatInput(aiContext);
        setAiContext(''); // Consume it
     }
  }, [aiContext, setAiContext]);

  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
     e.preventDefault();
     if (!chatInput.trim()) return;
     if (!apiKey) {
        setMessages(p => [...p, {role: 'bot', content: 'Please configure your Gemini API key in the Settings tab.'}]);
        return;
     }

     const userText = chatInput;
     const newHistory = [...messages, {role: 'user', content: userText, image_data: attachment}];
     setMessages(newHistory);
     setChatInput('');
     setAttachment(null);
     setIsLoading(true);

     try {
       const res = await axios.post('/api/chat', { 
         messages: newHistory,
         gemini_key: apiKey,
         persona: aiPersona
       });
       setMessages(p => [...p, {role: 'bot', content: res.data.reply}]);
     } catch (err) {
       console.error(err);
       setMessages(p => [...p, {role: 'bot', content: 'Connection to AI Backend failed. Ensure FastAPI is running.'}]);
     } finally {
       setIsLoading(false);
     }
  };

  const handleNewChat = () => {
      const fresh = [{ role: 'bot', content: 'Wazuh AI Threat Hunter initiated. Send natural language queries to search through OpenSearch logs, or ask for endpoint analysis compliance reports. (Powered by Gemini 2.5)' }];
      setMessages(fresh);
      localStorage.setItem('chat_history', JSON.stringify(fresh));
  };

   const handleApproveAction = async (actionData) => {
      const newHistory = [...messages, {role: 'user', content: `Execute the action: ${actionData.command} on agent ${actionData.agent_id} with args ${JSON.stringify(actionData.arguments)}`}];
      setMessages(newHistory);
      setIsLoading(true);
      try {
         const res = await axios.post('/api/action', {
            agent_id: actionData.agent_id,
            command: actionData.command,
            arguments: actionData.arguments
         });
         setMessages(p => [...p, {role: 'bot', content: `Action Result: ${res.data.status} - ${res.data.message}`}]);
      } catch (err) {
         setMessages(p => [...p, {role: 'bot', content: `Action failed: ${err.message}`}]);
      } finally {
         setIsLoading(false);
      }
  };

  const triggerAutonomousHunt = () => {
       axios.post('/api/trigger_autonomous', {
          alert_id: "critical-DEMO",
          srcip: "192.168.1.100",
          gemini_key: apiKey
       }).catch(e => console.error(e));
  };

  return (
    <div className="hunter-layout">
       <div style={{display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', borderRadius: '12px 12px 0 0'}}>
           <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
               <h3 style={{margin: 0, color: 'var(--text-active)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                 <Terminal size={18}/> AI Workspace
                 {agentStatus && (
                     <span className="pill" style={{marginLeft: '12px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-blue)', border: '1px solid rgba(56, 189, 248, 0.3)'}}>
                        <Activity size={12} style={{marginRight: '6px'}} className="spin-slow" /> {agentStatus}
                     </span>
                 )}
               </h3>
               <select value={aiPersona} onChange={(e) => setAiPersona(e.target.value)} style={{background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', color: 'var(--text-active)', padding: '6px 12px', borderRadius: '6px', outline: 'none', fontSize: '0.85rem'}}>
                  <option value="Threat Hunter">Threat Hunter & Forensics</option>
                  <option value="Remediation Engineer">Remediation Engineer</option>
                  <option value="Compliance Auditor">Compliance Auditor</option>
                  <option value="Manager">Full Orchestration (Manager)</option>
               </select>
           </div>
           <div style={{display: 'flex', gap: '8px'}}>
               <button onClick={triggerAutonomousHunt} className="primary-btn" style={{padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px'}}><Zap size={14}/> Agentic Auto-Hunt</button>
               <button onClick={handleNewChat} className="btn-secondary" style={{padding: '6px 12px', fontSize: '0.8rem'}}>+ New Chat</button>
           </div>
       </div>
       <div className="chat-box" style={{borderRadius: '0 0 12px 12px', height: 'calc(100% - 62px)', borderTop: 'none'}}>
          <div className="chat-history">
             {messages.map((m, i) => {
                const parsed = m.role === 'bot' ? parseMessageContent(m.content) : {text: m.content, action: null};
                return (
                  <div key={i} className={`chat-bubble ${m.role}`}>
                    <div style={{display: 'flex', alignItems: 'flex-start', gap: '8px'}}>
                      {m.role === 'bot' && <Terminal size={16} style={{marginTop: '4px', flexShrink: 0}}/>}
                      <div style={{width: '100%', overflowX: 'auto'}}>
                        {m.image_data && (
                           <div style={{marginBottom: '12px'}}>
                              <img src={m.image_data} alt="Upload" style={{maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border-color)'}}/>
                           </div>
                        )}
                        {m.role === 'bot' ? (
                          <div className="markdown-content">
                            <ReactMarkdown>{parsed.text}</ReactMarkdown>
                            {parsed.action && (
                               <div style={{marginTop: '12px', padding: '16px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}}>
                                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontWeight: 600, marginBottom: '8px'}}>
                                     <AlertTriangle size={16}/> Warning: Active Mitigation Recommended
                                  </div>
                                  <div style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px'}}>
                                     {parsed.action.description}
                                  </div>
                                  <div style={{fontSize: '0.85rem', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', marginBottom: '12px'}}>
                                     Command: {parsed.action.command}<br/>
                                     Agent: {parsed.action.agent_id}<br/>
                                     Args: {JSON.stringify(parsed.action.arguments)}
                                  </div>
                                  <div style={{display: 'flex', gap: '8px'}}>
                                     <button className="primary-btn" style={{background: 'var(--danger)', border: 'none'}} onClick={() => handleApproveAction(parsed.action)}>Approve Action</button>
                                     <button className="btn-secondary" onClick={() => setMessages(p => [...p, {role: 'user', content: 'Action rejected by user.'}])}>Reject</button>
                                  </div>
                               </div>
                            )}
                          </div>
                        ) : (
                          m.content
                        )}
                      </div>
                    </div>
                 </div>
                )
             })}
             {isLoading && (
                 <div className="chat-bubble bot">
                    <Terminal size={14} style={{marginBottom: '-2px', marginRight: '8px'}}/>
                    <em>Analyzing with Gemini 2.5 Flash...</em>
                 </div>
             )}
             <div ref={messagesEndRef} />
          </div>
          <form className="chat-input-wrapper" onSubmit={handleSubmit} style={{flexDirection: 'column'}}>
             {attachment && (
                <div style={{position: 'relative', width: 'fit-content', marginBottom: '8px'}}>
                   <img src={attachment} style={{height: '60px', borderRadius: '6px', border: '1px solid var(--border-color)'}}/>
                   <button type="button" onClick={() => setAttachment(null)} style={{position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0}}><X size={12}/></button>
                </div>
             )}
             <div style={{display: 'flex', gap: '16px', width: '100%'}}>
                 <button type="button" onClick={() => fileInputRef.current.click()} className="icon-btn" style={{width: 48, height: 48, borderRadius: 8, flexShrink: 0}} disabled={isLoading}><Paperclip size={18}/></button>
                 <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                 <input type="text" placeholder="e.g. Analyze this screenshot, or summarize the active alerts." value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isLoading} style={{flex: 1}} />
                 <button type="submit" className="chat-btn" disabled={isLoading} style={{opacity: isLoading ? 0.5 : 1, width: 48, height: 48, flexShrink: 0}}><Send size={18}/></button>
             </div>
          </form>
       </div>
    </div>
  );
}

// -----------------------------------------------------------------------------------
// SETTINGS VIEW (For API Keys)
// -----------------------------------------------------------------------------------
function SettingsView({ apiKey, setApiKey }) {
   const [tempKey, setTempKey] = useState(apiKey);
   const [saved, setSaved] = useState(false);

   const handleSave = () => {
      setApiKey(tempKey);
      localStorage.setItem('gemini_api_key', tempKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
   };

   return (
      <div className="dashboard-content">
         <div className="card" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            <div className="card-header">
               <div>
                  <h3 className="card-title">API Configuration</h3>
                  <p className="card-subtitle">Set your required keys for the Threat Hunter to function.</p>
               </div>
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
               <div>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-muted)'}}>Gemini API Key</label>
                  <input 
                     type="password" 
                     value={tempKey} 
                     onChange={(e) => setTempKey(e.target.value)}
                     placeholder="AIzaSy..."
                     style={{
                        width: '100%', padding: '12px', borderRadius: '8px', 
                        border: '1px solid var(--border-color)', background: 'var(--bg-main)', 
                        color: 'white', outline: 'none'
                     }}
                  />
                  <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px'}}>
                     Needed for the Natural Language Threat Hunter. Recommended models: Gemini 2.5 Flash.
                  </p>
               </div>

               <button className="primary-btn" onClick={handleSave}>
                  <Save size={18} /> Save Settings
               </button>

               {saved && (
                  <div style={{padding: '12px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                     <CheckCircle2 size={18} /> Keys saved to local storage!
                  </div>
               )}
            </div>
         </div>
      </div>
   )
}

// -----------------------------------------------------------------------------------
// ENDPOINTS VIEW
// -----------------------------------------------------------------------------------
function EndpointsView() {
   const [endpoints, setEndpoints] = useState([]);
   const [loading, setLoading] = useState(true);
   const [reportHtml, setReportHtml] = useState(null);
   const [reportModalOpen, setReportModalOpen] = useState(false);

   useEffect(() => {
      axios.get('/api/endpoints')
        .then(res => {
           setEndpoints(res.data);
           setLoading(false);
        })
        .catch(err => {
           console.error("Endpoints error:", err);
           setLoading(false);
        });
   }, []);

   const generateBrief = (agent_id) => {
      setReportHtml(null);
      setReportModalOpen(true);
      const key = localStorage.getItem('gemini_api_key');
      axios.post('/api/reports/generate', { agent_id: agent_id, gemini_key: key })
         .then(res => setReportHtml(res.data.report))
         .catch(err => setReportHtml("Failed to generate report: " + err.message));
   };

   return (
      <div className="dashboard-content">
         <div className="card" style={{width: '100%'}}>
            <div className="card-header">
               <div>
                  <h3 className="card-title">Endpoints Inventory</h3>
                  <p className="card-subtitle">Live agents connected to the Wazuh manager.</p>
               </div>
            </div>
            {loading ? <div style={{padding: '20px'}}>Loading endpoints...</div> : (
               <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '16px'}}>
                  <thead>
                     <tr style={{borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)'}}>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Agent Name</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>IP Address</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Operating System</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Status</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Version</th>
                     </tr>
                  </thead>
                  <tbody>
                     {endpoints.map((ep, i) => (
                        <tr key={i} style={{borderBottom: '1px solid var(--border-color)', color: 'var(--text-active)'}}>
                           <td style={{padding: '16px'}}>{ep.name}</td>
                           <td style={{padding: '16px'}}>{ep.ip}</td>
                           <td style={{padding: '16px'}}>{ep.os?.name || ep.os?.full_name || 'Unknown'}</td>
                           <td style={{padding: '16px'}}>
                              <span className={`pill ${ep.status === 'active' ? 'success' : 'danger'}`}>{ep.status}</span>
                           </td>
                           <td style={{padding: '16px', color: 'var(--text-muted)'}}>{ep.version}</td>
                           <td style={{padding: '16px'}}>
                               <button className="btn-secondary" style={{padding: '4px 8px', fontSize: '0.8rem'}} onClick={() => generateBrief(ep.id || '001')}>Generate Brief</button>
                           </td>
                        </tr>
                     ))}
                     {endpoints.length === 0 && <tr><td colSpan="6" style={{padding: '20px', textAlign: 'center'}}>No agents found.</td></tr>}
                  </tbody>
               </table>
            )}
         </div>
         
         {reportModalOpen && (
            <div style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
               <div className="card" style={{width: '80%', maxWidth: '800px', height: '80%', display: 'flex', flexDirection: 'column'}}>
                  <div className="card-header" style={{borderBottom: '1px solid var(--border-color)', paddingBottom: '16px'}}>
                     <h3 className="card-title">Executive Agent Threat Brief</h3>
                     <button onClick={() => setReportModalOpen(false)} className="btn-secondary text-sm"><X size={16}/></button>
                  </div>
                  <div style={{flex: 1, overflowY: 'auto', padding: '20px'}} className="markdown-content">
                     {reportHtml ? <ReactMarkdown>{reportHtml}</ReactMarkdown> : <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>Generating AI report... please wait about 10 seconds.</div>}
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

// -----------------------------------------------------------------------------------
// SECURITY REPORTS VIEW
// -----------------------------------------------------------------------------------
function SecurityReportsView({ setAiContext, setActiveTab }) {
   const [reportTab, setReportTab] = useState('CVE');
   const [vulns, setVulns] = useState([]);
   const [scaItems, setScaItems] = useState([]);
   const [scaAgentInfo, setScaAgentInfo] = useState({});
   const [loading, setLoading] = useState(true);
   const [expandedRow, setExpandedRow] = useState(null);
   const [reportHtml, setReportHtml] = useState(null);
   const [reportModalOpen, setReportModalOpen] = useState(false);
   const [generatingScript, setGeneratingScript] = useState(null);
   const [generatedScripts, setGeneratedScripts] = useState({});
   const [fimEvents, setFimEvents] = useState([]);
   const [fimExplanations, setFimExplanations] = useState({});

   useEffect(() => {
      axios.get('/api/reports')
        .then(res => {
           setVulns(res.data);
           return axios.get('/api/sca');
        })
        .then(res => {
           setScaItems(res.data.failed_checks || []);
           setScaAgentInfo({ agent_id: res.data.agent_id, os: res.data.os });
           return axios.get('/api/fim');
        })
        .then(res => {
           setFimEvents(res.data || []);
           setLoading(false);
        })
        .catch(err => {
           console.error("Reports error:", err);
           setLoading(false);
        });
   }, []);

   const analyzeFimEvent = (item) => {
       setFimExplanations(prev => ({...prev, [item.id]: { loading: true }}));
       const key = localStorage.getItem('gemini_api_key');
       axios.post('/api/explain/fim', {
           agent_id: item.agent,
           path: item.path,
           event_type: item.event_type,
           md5_before: item.md5_before,
           md5_after: item.md5_after,
           diff: item.diff,
           gemini_key: key || ""
       }).then(res => {
           setFimExplanations(prev => ({...prev, [item.id]: { data: res.data.explanation }}));
       }).catch(err => {
           setFimExplanations(prev => ({...prev, [item.id]: { data: "Error analyzing FIM event: " + err.message }}));
       });
   };

   const generateScaScript = (item) => {
       setGeneratingScript(item.id);
       const key = localStorage.getItem('gemini_api_key');
       axios.post('/api/remediate/sca', {
           agent_id: scaAgentInfo.agent_id,
           os_name: scaAgentInfo.os,
           rationale: item.rationale,
           title: item.title,
           gemini_key: key || ""
       }).then(res => {
           setGeneratedScripts(prev => ({...prev, [item.id]: res.data.script}));
           setGeneratingScript(null);
       }).catch(err => {
           setGeneratedScripts(prev => ({...prev, [item.id]: "# Error: " + err.message}));
           setGeneratingScript(null);
       });
   };

   const copyToClipboard = (text) => {
       navigator.clipboard.writeText(text);
       alert("Script copied to clipboard!");
   };

   const generateGlobalBrief = () => {
      setReportHtml(null);
      setReportModalOpen(true);
      const key = localStorage.getItem('gemini_api_key');
      axios.post('/api/reports/generate', { agent_id: 'global', gemini_key: key })
         .then(res => setReportHtml(res.data.report))
         .catch(err => setReportHtml("Failed to generate report: " + err.message));
   };

   const handleAskAI = (v) => {
      setAiContext(`Review this vulnerability: ${v.id} in ${v.package_name}. Given the condition: "${v.condition}", provide technical remediation steps.`);
      setActiveTab('AITask');
   };

   const handleDownloadPDF = () => {
      const doc = new jsPDF();
      doc.text("Wazuh Security Report - Active Vulnerabilities", 14, 15);
      const tableData = vulns.map(v => [v.id, v.severity, `${v.package_name} (${v.package_version})`, v.agent_name]);
      autoTable(doc, {
         head: [['CVE ID', 'Severity', 'Package', 'Agent']],
         body: tableData,
         startY: 20
      });
      doc.save('wazuh-vulnerability-report.pdf');
   };

   return (
      <div className="dashboard-content">
         <div className="card" style={{width: '100%'}}>
            <div className="card-header" style={{flexDirection: 'column', gap: '16px'}}>
               <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
                 <div>
                    <h3 className="card-title">Security Posture Assessment</h3>
                    <p className="card-subtitle">Active CVEs and misconfigurations isolated by Wazuh.</p>
                 </div>
                 <div style={{display: 'flex', gap: '8px'}}>
                    <button className="primary-btn" onClick={() => generateGlobalBrief()}>Global Threat Brief</button>
                    <button className="btn-secondary" onClick={handleDownloadPDF}>Export Table PDF</button>
                 </div>
               </div>
               <div style={{display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', width: '100%'}}>
                   <div onClick={() => setReportTab('CVE')} style={{padding: '8px 4px', cursor: 'pointer', borderBottom: reportTab === 'CVE' ? '2px solid var(--primary-blue)' : '2px solid transparent', color: reportTab === 'CVE' ? 'var(--text-active)' : 'var(--text-muted)', fontWeight: 500}}>Vulnerabilities (CVE)</div>
                   <div onClick={() => setReportTab('SCA')} style={{padding: '8px 4px', cursor: 'pointer', borderBottom: reportTab === 'SCA' ? '2px solid var(--primary-blue)' : '2px solid transparent', color: reportTab === 'SCA' ? 'var(--text-active)' : 'var(--text-muted)', fontWeight: 500}}>Configuration Checks (SCA)</div>
                   <div onClick={() => setReportTab('FIM')} style={{padding: '8px 4px', cursor: 'pointer', borderBottom: reportTab === 'FIM' ? '2px solid var(--primary-blue)' : '2px solid transparent', color: reportTab === 'FIM' ? 'var(--text-active)' : 'var(--text-muted)', fontWeight: 500}}>File Integrity (FIM)</div>
               </div>
            </div>
            {loading ? <div style={{padding: '20px'}}>Analyzing Posture Data...</div> : (
               reportTab === 'CVE' ? (
               <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '16px'}}>
                  <thead>
                     <tr style={{borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)'}}>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>CVE ID</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Severity</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Package</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Agent</th>
                     </tr>
                  </thead>
                  <tbody>
                     {vulns.map((v, i) => (
                        <React.Fragment key={i}>
                        <tr onClick={() => setExpandedRow(expandedRow === i ? null : i)} style={{borderBottom: expandedRow === i ? 'none': '1px solid var(--border-color)', color: 'var(--text-active)', cursor: 'pointer', background: expandedRow === i ? 'rgba(255,255,255,0.02)' : 'transparent'}}>
                           <td style={{padding: '16px', fontWeight: 500, color: 'var(--primary-blue)'}}>{v.id}</td>
                           <td style={{padding: '16px'}}>
                              <span className={`pill ${v.severity === 'Critical' ? 'danger' : v.severity === 'High' ? 'danger' : 'success'}`}
                                    style={v.severity === 'High' ? {background: '#9a3412', color: '#ffedd5'} : {}}>
                                 {v.severity}
                              </span>
                           </td>
                           <td style={{padding: '16px'}}>{v.package_name} <span style={{color: 'var(--text-muted)'}}>{v.package_version}</span></td>
                           <td style={{padding: '16px', color: 'var(--text-muted)'}}>{v.agent_name} <ChevronRight style={{float:'right', transform: expandedRow === i ? 'rotate(90deg)' : 'none', transition: '0.2s', opacity: 0.5}} size={16}/></td>
                        </tr>
                        {expandedRow === i && (
                           <tr style={{borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)'}}>
                              <td colSpan={4} style={{padding: '0 24px 24px 24px'}}>
                                  <div style={{background: 'var(--bg-sidebar)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                                      <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px'}}><strong>Description:</strong> {v.description}</div>
                                      <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px'}}><strong>Condition/Fix:</strong> {v.condition}</div>
                                      <div style={{display: 'flex', gap: '12px'}}>
                                         <button onClick={(e) => {e.stopPropagation(); handleAskAI(v);}} className="primary-btn"><Terminal size={14}/> Ask Remediation AI</button>
                                         {v.reference && <a href={v.reference.split(',')[0]} target="_blank" rel="noreferrer" style={{padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'none'}}>View NVD Database</a>}
                                      </div>
                                  </div>
                              </td>
                           </tr>
                        )}
                        </React.Fragment>
                     ))}
                     {vulns.length === 0 && <tr><td colSpan="4" style={{padding: '20px', textAlign: 'center'}}>No vulnerabilities detected!</td></tr>}
                  </tbody>
               </table>
               ) : reportTab === 'SCA' ? (
               <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '16px'}}>
                  <thead>
                     <tr style={{borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)'}}>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Policy Engine</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Check Title</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Status</th>
                     </tr>
                  </thead>
                  <tbody>
                     {scaItems.map((s, i) => (
                        <React.Fragment key={i}>
                        <tr onClick={() => setExpandedRow(expandedRow === `sca-${i}` ? null : `sca-${i}`)} style={{borderBottom: expandedRow === `sca-${i}` ? 'none': '1px solid var(--border-color)', color: 'var(--text-active)', cursor: 'pointer', background: expandedRow === `sca-${i}` ? 'rgba(255,255,255,0.02)' : 'transparent'}}>
                           <td style={{padding: '16px', color: 'var(--text-muted)'}}>{s.policy}</td>
                           <td style={{padding: '16px', fontWeight: 500}}>{s.title}</td>
                           <td style={{padding: '16px'}}><span className="pill danger">{s.result}</span> <ChevronRight style={{float:'right', transform: expandedRow === `sca-${i}` ? 'rotate(90deg)' : 'none', transition: '0.2s', opacity: 0.5}} size={16}/></td>
                        </tr>
                        {expandedRow === `sca-${i}` && (
                           <tr style={{borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)'}}>
                              <td colSpan={3} style={{padding: '0 24px 24px 24px'}}>
                                  <div style={{background: 'var(--bg-sidebar)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                                      <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px'}}><strong>Rationale:</strong> {s.rationale}</div>
                                      {generatedScripts[s.id] ? (
                                          <div>
                                              <div style={{display: 'flex', justifyContent: 'space-between', background: '#1e1e1e', padding: '8px 12px', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', border: '1px solid var(--border-color)', borderBottom: 'none'}}>
                                                  <span style={{fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'monospace'}}>Generated AI Script • {scaAgentInfo.os}</span>
                                                  <button onClick={(e) => {e.stopPropagation(); copyToClipboard(generatedScripts[s.id]);}} style={{background: 'transparent', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px'}}><FileText size={14}/> Copy to Clipboard</button>
                                              </div>
                                              <pre style={{margin: 0, padding: '16px', background: '#0d1117', border: '1px solid var(--border-color)', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', overflowX: 'auto', color: '#e6edf3', fontSize: '0.85rem', fontFamily: 'monospace'}}>{generatedScripts[s.id]}</pre>
                                          </div>
                                      ) : (
                                          <button onClick={(e) => {e.stopPropagation(); generateScaScript(s);}} className="primary-btn" disabled={generatingScript === s.id} style={{opacity: generatingScript === s.id ? 0.5 : 1}}>
                                              <Terminal size={14}/> {generatingScript === s.id ? "Generating Script via Agentic Loop..." : `Generate Auto-Remediation Payload (${scaAgentInfo.os})`}
                                          </button>
                                      )}
                                  </div>
                              </td>
                           </tr>
                        )}
                        </React.Fragment>
                     ))}
                     {scaItems.length === 0 && <tr><td colSpan="3" style={{padding: '20px', textAlign: 'center'}}>No SCA failures detected!</td></tr>}
                  </tbody>
               </table>
               ) : (
               <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '16px'}}>
                  <thead>
                     <tr style={{borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)'}}>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>File Path</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Change Event</th>
                        <th style={{padding: '12px 16px', fontWeight: 500}}>Agent</th>
                     </tr>
                  </thead>
                  <tbody>
                     {fimEvents.map((f, i) => (
                        <React.Fragment key={i}>
                        <tr onClick={() => setExpandedRow(expandedRow === `fim-${i}` ? null : `fim-${i}`)} style={{borderBottom: expandedRow === `fim-${i}` ? 'none': '1px solid var(--border-color)', color: 'var(--text-active)', cursor: 'pointer', background: expandedRow === `fim-${i}` ? 'rgba(255,255,255,0.02)' : 'transparent'}}>
                           <td style={{padding: '16px', fontWeight: 500}}>{f.path}</td>
                           <td style={{padding: '16px'}}><span className={`pill ${f.event_type === 'deleted' ? 'danger' : 'warning'}`}>{f.event_type.toUpperCase()}</span></td>
                           <td style={{padding: '16px', color: 'var(--text-muted)'}}>{f.agent} <ChevronRight style={{float:'right', transform: expandedRow === `fim-${i}` ? 'rotate(90deg)' : 'none', transition: '0.2s', opacity: 0.5}} size={16}/></td>
                        </tr>
                        {expandedRow === `fim-${i}` && (
                           <tr style={{borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)'}}>
                              <td colSpan={3} style={{padding: '0 24px 24px 24px'}}>
                                  <div style={{background: 'var(--bg-sidebar)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                                      <div style={{display: 'flex', gap: '24px', marginBottom: '16px'}}>
                                         <div style={{flex: 1}}>
                                            <div style={{color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px'}}>MD5 Before</div>
                                            <div style={{fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-active)'}}>{f.md5_before || 'N/A'}</div>
                                         </div>
                                         <div style={{flex: 1}}>
                                            <div style={{color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px'}}>MD5 After</div>
                                            <div style={{fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-active)'}}>{f.md5_after || 'N/A'}</div>
                                         </div>
                                      </div>
                                      {f.diff && (
                                          <div style={{marginBottom: '16px'}}>
                                              <div style={{color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px'}}>Raw Diff</div>
                                              <pre style={{margin: 0, padding: '12px', background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto', color: '#e6edf3', fontSize: '0.8rem', fontFamily: 'monospace'}}>{f.diff}</pre>
                                          </div>
                                      )}
                                      
                                      <div style={{borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px'}}>
                                          {fimExplanations[f.id] ? (
                                              fimExplanations[f.id].loading ? (
                                                  <div style={{color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                      <Terminal size={14}/> Generating security intel via Fallback LLM sequence...
                                                  </div>
                                              ) : (
                                                  <div className="markdown-content">
                                                      <ReactMarkdown>{fimExplanations[f.id].data}</ReactMarkdown>
                                                  </div>
                                              )
                                          ) : (
                                              <button onClick={(e) => {e.stopPropagation(); analyzeFimEvent(f);}} className="primary-btn">
                                                  <Terminal size={14}/> Generate AI FIM Assessment
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              </td>
                           </tr>
                        )}
                        </React.Fragment>
                     ))}
                     {fimEvents.length === 0 && <tr><td colSpan="3" style={{padding: '20px', textAlign: 'center'}}>No FIM events detected!</td></tr>}
                  </tbody>
               </table>
               )
            )}
         </div>

         {reportModalOpen && (
            <div style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
               <div className="card" style={{width: '80%', maxWidth: '800px', height: '80%', display: 'flex', flexDirection: 'column'}}>
                  <div className="card-header" style={{borderBottom: '1px solid var(--border-color)', paddingBottom: '16px'}}>
                     <h3 className="card-title">Executive Global Threat Brief</h3>
                     <button onClick={() => setReportModalOpen(false)} className="btn-secondary text-sm"><X size={16}/></button>
                  </div>
                  <div style={{flex: 1, overflowY: 'auto', padding: '20px'}} className="markdown-content">
                     {reportHtml ? <ReactMarkdown>{reportHtml}</ReactMarkdown> : <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>Generating AI Global Risk Report... please wait up to 15 seconds.</div>}
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

function MockupView({title, desc}) {
   return (
      <div className="dashboard-content" style={{alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'var(--text-muted)', flexDirection: 'column'}}>
         <MousePointer2 size={64} style={{opacity: 0.2, marginBottom: '24px'}} />
         <h2 style={{color: 'var(--text-active)', margin: 0, marginBottom: '8px'}}>{title}</h2>
         <p>{desc}</p>
         <div style={{marginTop: '24px'}}>
            <button className="primary-btn">Initialize Module</button>
         </div>
      </div>
   )
}

function LiveThreatFeed() {
   const [alerts, setAlerts] = useState([]);
   useEffect(() => {
      axios.get('/api/recent_alerts')
         .then(res => setAlerts(res.data))
         .catch(err => console.error("Feed error:", err));
   }, []);
   return (
      <div className="card" style={{minHeight: '300px'}}>
         <div className="card-header">
             <div>
                 <h3 className="card-title">Live Threat Intelligence</h3>
                 <p className="card-subtitle">Real-time security events across the cluster.</p>
             </div>
             <span className="pill"><Activity size={12}/> Live</span>
         </div>
         <div style={{maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px'}}>
             {alerts.map((a, i) => (
                <div key={i} style={{padding: '12px', background: 'var(--bg-sidebar)', borderRadius: '8px', borderLeft: `3px solid ${a.level >= 10 ? 'var(--danger)' : a.level >= 5 ? 'var(--warning, #f59e0b)' : 'var(--primary-blue)'}`}}>
                   <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                       <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>{a.timestamp.replace('T', ' ').slice(0, 19)}</span>
                       <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Agent: {a.agent}</span>
                   </div>
                   <div style={{fontWeight: 500, color: 'var(--text-active)', fontSize: '0.95rem'}}>{a.desc}</div>
                   <div style={{marginTop: '8px', fontSize: '0.8rem'}}>
                       <span className="pill" style={{background: 'rgba(255,255,255,0.05)', marginRight: '8px'}}>Level {a.level}</span>
                       {a.mitre && a.mitre.length > 0 && <span className="pill" style={{background: 'rgba(255,255,255,0.05)'}}>{a.mitre[0]}</span>}
                   </div>
                </div>
             ))}
             {alerts.length === 0 && <div style={{padding: '20px', textAlign: 'center', color: 'var(--text-muted)'}}>Listening for alerts...</div>}
         </div>
      </div>
   );
}

// -----------------------------------------------------------------------------------
// ATTACK GRAPH VIEW
// -----------------------------------------------------------------------------------

const CustomNode = ({ data }) => {
  const isAttacker = data.type === 'attacker';
  return (
    <div className={`graph-node ${isAttacker ? 'node-attacker' : 'node-agent'} ${data.critical ? 'node-critical' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div className="node-icon">{isAttacker ? <Terminal size={14}/> : <Box size={14}/>}</div>
      <div className="node-label">
        <div style={{fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>{data.type}</div>
        <div style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{data.label}</div>
      </div>
      {data.critical && <div className="node-badge"><AlertTriangle size={10}/> CRITICAL</div>}
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

function AttackGraphView() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/attack_graph')
      .then(res => {
         const fetchedNodes = res.data.nodes || [];
         const fetchedEdges = res.data.edges || [];
         
         const formattedEdges = fetchedEdges.map(e => ({
            ...e,
            markerEnd: { type: MarkerType.ArrowClosed, color: e.style?.stroke || '#f59e0b' }
         }));

         const formattedNodes = fetchedNodes.map(n => ({
            ...n,
            type: 'custom',
         }));

         setNodes(formattedNodes);
         setEdges(formattedEdges);
         setLoading(false);
      })
      .catch(err => {
         console.error('Graph Error', err);
         setLoading(false);
      });
  }, []);

  const onNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes) => setEdges((eds) => applyEdgeChanges(changes, eds));

  return (
    <div className="dashboard-content" style={{height: '80vh', display: 'flex', flexDirection: 'column'}}>
      <div className="card" style={{flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: 0, overflow: 'hidden'}}>
         <div className="card-header" style={{borderBottom: '1px solid var(--border-color)', padding: '20px'}}>
             <div>
                <h3 className="card-title">Visual Attack Path Mapping</h3>
                <p className="card-subtitle">AI-correlated lateral movement and breach paths.</p>
             </div>
             <div style={{display: 'flex', gap: '8px'}}>
                 <span className="pill"><div style={{width: 8, height: 8, borderRadius: '50%', background: '#ef4444'}}></div> Active Threat</span>
                 <span className="pill"><div style={{width: 8, height: 8, borderRadius: '50%', background: '#f59e0b'}}></div> Reconnaissance</span>
             </div>
         </div>
         <div style={{flex: 1, position: 'relative'}} className="graph-container">
            {loading ? <div style={{padding: '40px', textAlign: 'center'}}>Correlating OpenSearch events...</div> : (
              <ReactFlow 
                  nodes={nodes} 
                  edges={edges} 
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={nodeTypes}
                  fitView
                  attributionPosition="bottom-right"
                  colorMode="dark"
              >
                 <Background color="#333" gap={16} />
                 <Controls />
              </ReactFlow>
            )}
         </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------------
// MITRE MATRIX VIEW
// -----------------------------------------------------------------------------------
function MitreMatrixView() {
   const [metrics, setMetrics] = useState({});
   const [loading, setLoading] = useState(true);

   const tactics = [
      { name: "Initial Access", techniques: [{id: "T1189", name: "Drive-by Compromise"}, {id: "T1190", name: "Exploit Public-Facing App"}, {id: "T1078", name: "Valid Accounts"}, {id: "T1566", name: "Phishing"}] },
      { name: "Execution", techniques: [{id: "T1059", name: "Command and Scripting Interpreter"}, {id: "T1047", name: "WMI"}, {id: "T1204", name: "User Execution"}] },
      { name: "Persistence", techniques: [{id: "T1543", name: "Create or Modify System Process"}, {id: "T1546", name: "Event Triggered Execution"}, {id: "T1136", name: "Create Account"}] },
      { name: "Priv. Esc.", techniques: [{id: "T1548", name: "Abuse Elevation Control"}, {id: "T1134", name: "Access Token Manipulation"}, {id: "T1053", name: "Scheduled Task/Job"}] },
      { name: "Def. Evasion", techniques: [{id: "T1222", name: "File and Directory Permissions Modification"}, {id: "T1070", name: "Indicator Removal"}] },
      { name: "Cred. Access", techniques: [{id: "T1110", name: "Brute Force"}, {id: "T1003", name: "OS Credential Dumping"}, {id: "T1555", name: "Credentials from Passwords Stores"}] },
      { name: "Discovery", techniques: [{id: "T1082", name: "System Info Discovery"}, {id: "T1083", name: "File and Directory Discovery"}, {id: "T1040", name: "Network Sniffing"}] },
      { name: "Lat. Movement", techniques: [{id: "T1210", name: "Exploitation of Remote Services"}, {id: "T1021", name: "Remote Services"}] }
   ];

   useEffect(() => {
      axios.get('/api/mitre')
         .then(res => {
            setMetrics(res.data || {});
            setLoading(false);
         })
         .catch(err => {
            console.error("Mitre fetch error", err);
            setLoading(false);
         });
   }, []);

   const getIntensityColor = (count) => {
       if (!count || count === 0) return 'rgba(255,255,255,0.02)';
       if (count < 5) return 'rgba(234, 179, 8, 0.4)';  // Warning/yellow
       if (count < 15) return 'rgba(249, 115, 22, 0.6)'; // Orange
       return 'rgba(220, 38, 38, 0.8)'; // Red/Critical
   };

   return (
      <div className="dashboard-content" style={{maxWidth: '100%', overflowX: 'auto'}}>
         <div className="card" style={{width: '100%', minWidth: '1200px'}}>
            <div className="card-header">
               <div>
                  <h3 className="card-title">Global MITRE ATT&CK Heatmap</h3>
                  <p className="card-subtitle">Real-time tactical progression across all endpoints based on Wazuh rule alerts.</p>
               </div>
            </div>
            {loading ? <div style={{padding: '20px'}}>Aggregating matrix telemetry...</div> : (
               <div style={{display: 'flex', gap: '8px', padding: '16px'}}>
                   {tactics.map((tactic, i) => (
                      <div key={i} style={{minWidth: '140px', flex: 1}}>
                          <div style={{background: 'var(--bg-sidebar)', padding: '12px 8px', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', border: '1px solid var(--border-color)', borderBottom: 'none', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-active)', textAlign: 'center'}}>
                              {tactic.name}
                          </div>
                          <div style={{display: 'flex', flexDirection: 'column'}}>
                              {tactic.techniques.map((tech, j) => {
                                  const count = metrics[tech.id] || 0;
                                  return (
                                      <div key={j} style={{background: getIntensityColor(count), border: '1px solid var(--border-color)', padding: '10px 8px', fontSize: '0.75rem', color: count > 0 ? '#fff' : 'var(--text-muted)', marginBottom: '-1px', display: 'flex', flexDirection: 'column', minHeight: '80px', justifyContent: 'center', position: 'relative'}}>
                                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                                             <span style={{fontWeight: 600}}>{tech.id}</span>
                                             {count > 0 && <span style={{background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px', fontSize: '0.65rem'}}>{count}</span>}
                                          </div>
                                          <div style={{lineHeight: '1.2'}}>{tech.name}</div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                   ))}
               </div>
            )}
         </div>
      </div>
   );
}

// -----------------------------------------------------------------------------------
// NETWORK ACTIVITY VIEW
// -----------------------------------------------------------------------------------
function NetworkActivityView() {
   const [sockets, setSockets] = useState([]);
   const [loading, setLoading] = useState(true);
   const [analysis, setAnalysis] = useState(null);
   const [analyzing, setAnalyzing] = useState(false);

   useEffect(() => {
      axios.get('/api/sockets')
         .then(res => {
            setSockets(res.data || []);
            setLoading(false);
         })
         .catch(err => {
            console.error("Sockets fetch error", err);
            setLoading(false);
         });
   }, []);

   const analyzeSockets = () => {
       setAnalyzing(true);
       const key = localStorage.getItem('gemini_api_key');
       axios.post('/api/analyze/sockets', { sockets: sockets, gemini_key: key || "" })
           .then(res => {
               setAnalysis(res.data.analysis);
               setAnalyzing(false);
           })
           .catch(err => {
               setAnalysis("Error gathering intel: " + err.message);
               setAnalyzing(false);
           });
   };

   return (
      <div className="dashboard-content">
         <div className="card" style={{width: '100%'}}>
            <div className="card-header" style={{borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px'}}>
               <div>
                  <h3 className="card-title">Host Network Sockets</h3>
                  <p className="card-subtitle">Syscollector telemetry identifying bound ports and established tunnels.</p>
               </div>
               <div>
                  <button className="primary-btn" onClick={analyzeSockets} disabled={analyzing} style={{display: 'flex', alignItems: 'center', gap: '8px', opacity: analyzing ? 0.6 : 1}}>
                     {analyzing ? <Activity size={16}/> : <Terminal size={16}/>} {analyzing ? "AI Hunting Anomaly..." : "Scan for Anomalies (AI)"}
                  </button>
               </div>
            </div>
            
            {analysis && (
                <div style={{background: 'var(--bg-sidebar)', padding: '20px', borderRadius: '8px', border: '1px solid var(--primary-blue)', margin: '0 20px 24px 20px'}}>
                   <div style={{display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--primary-blue)', fontWeight: 600, marginBottom: '12px'}}>
                       <Activity size={18}/> Cyber AI Assessment
                   </div>
                   <div className="markdown-content">
                       <ReactMarkdown>{analysis}</ReactMarkdown>
                   </div>
                </div>
            )}

            {loading ? <div style={{padding: '20px'}}>Querying open ports...</div> : (
               <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                     <tr style={{borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)'}}>
                        <th style={{padding: '12px 24px', fontWeight: 500}}>Process</th>
                        <th style={{padding: '12px 24px', fontWeight: 500}}>Protocol</th>
                        <th style={{padding: '12px 24px', fontWeight: 500}}>Local Address</th>
                        <th style={{padding: '12px 24px', fontWeight: 500}}>Remote Address</th>
                        <th style={{padding: '12px 24px', fontWeight: 500}}>State</th>
                     </tr>
                  </thead>
                  <tbody>
                     {sockets.map((s, i) => (
                        <tr key={i} style={{borderBottom: '1px solid var(--border-color)', color: 'var(--text-active)'}}>
                           <td style={{padding: '16px 24px', fontWeight: 600}}><span className="pill" style={{background: 'rgba(255,255,255,0.05)', color: '#e6edf3'}}>{s.process || "Unknown"}</span></td>
                           <td style={{padding: '16px 24px', color: 'var(--primary-blue)', textTransform: 'uppercase'}}>{s.protocol}</td>
                           <td style={{padding: '16px 24px', fontFamily: 'monospace', fontSize: '0.9rem'}}>{s.local?.ip}:{s.local?.port}</td>
                           <td style={{padding: '16px 24px', fontFamily: 'monospace', fontSize: '0.9rem'}}>{s.remote?.ip === '0.0.0.0' ? '-' : `${s.remote?.ip}:${s.remote?.port}`}</td>
                           <td style={{padding: '16px 24px'}}>
                              <span className={`pill ${s.state === 'listening' ? 'success' : s.state === 'established' ? 'warning' : ''}`} style={s.state === 'established' ? {background: '#9a3412', color: '#ffedd5'} : {}}>
                                 {s.state.toUpperCase()}
                              </span>
                           </td>
                        </tr>
                     ))}
                     {sockets.length === 0 && <tr><td colSpan="5" style={{padding: '20px', textAlign: 'center'}}>No active network sockets discovered.</td></tr>}
                  </tbody>
               </table>
            )}
         </div>
      </div>
   );
}

// -----------------------------------------------------------------------------------
// R3F CYBER BACKGROUND COMPONENT
// -----------------------------------------------------------------------------------
function GlobalWireframeGlobe() {
  const meshRef = useRef();
  useFrame((state) => {
    if(meshRef.current) {
        meshRef.current.rotation.y += 0.002;
        meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });
  return (
    <Sphere ref={meshRef} args={[2.8, 32, 24]} position={[0, -0.5, -3]}>
      <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.12} />
    </Sphere>
  );
}

function CyberParticles() {
  const ref = useRef();
  const sphere = React.useMemo(() => {
    const positions = new Float32Array(2500 * 3);
    for (let i = 0; i < 2500; i++) {
      positions[i*3] = (Math.random() - 0.5) * 20;
      positions[i*3+1] = (Math.random() - 0.5) * 20;
      positions[i*3+2] = (Math.random() - 0.5) * 20;
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    if(ref.current) {
      ref.current.rotation.x -= delta * 0.05;
      ref.current.rotation.y -= delta * 0.08;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#10b981" size={0.06} sizeAttenuation={true} depthWrite={false} blending={THREE.AdditiveBlending} />
      </Points>
    </group>
  );
}

function CameraRig() {
  const { camera, mouse } = useThree();
  useFrame(() => {
    camera.position.x += (mouse.x * 1.5 - camera.position.x) * 0.05;
    camera.position.y += (-mouse.y * 1.5 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function CyberBackground3D() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
        <CyberParticles />
        <GlobalWireframeGlobe />
        <CameraRig />
      </Canvas>
    </div>
  );
}

// -----------------------------------------------------------------------------------
// ACTIVE THREAT GLOBE 3D COMPONENT 
// -----------------------------------------------------------------------------------
function ActiveThreatGlobe() {
  const globeRef = useRef();
  const ringRef1 = useRef();
  const ringRef2 = useRef();

  useFrame((state) => {
    if (globeRef.current) {
        globeRef.current.rotation.y += 0.003;
        globeRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.1;
    }
    if (ringRef1.current) {
        ringRef1.current.rotation.x += 0.005;
        ringRef1.current.rotation.y += 0.008;
    }
    if (ringRef2.current) {
        ringRef2.current.rotation.x -= 0.007;
        ringRef2.current.rotation.y -= 0.01;
    }
  });

  return (
    <group position={[0, -0.2, 0]}>
      {/* Core Globe Wireframe */}
      <Sphere ref={globeRef} args={[1.8, 24, 24]}>
        <meshStandardMaterial color="#3b82f6" wireframe={true} transparent opacity={0.3} />
      </Sphere>
      {/* Inner Glow Core */}
      <Sphere args={[1.75, 32, 32]}>
         <meshBasicMaterial color="#0c4a6b" transparent opacity={0.4} />
      </Sphere>

      {/* Orbiting Tech Rings */}
      <mesh ref={ringRef1} rotation={[Math.PI/3, 0, 0]}>
         <torusGeometry args={[2.4, 0.015, 16, 100]} />
         <meshBasicMaterial color="#60a5fa" transparent opacity={0.6} />
      </mesh>
      <mesh ref={ringRef2} rotation={[-Math.PI/4, Math.PI/4, 0]}>
         <torusGeometry args={[2.7, 0.008, 16, 100]} />
         <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
      </mesh>

      {/* Threat Nodes / Attack Markers */}
      <group ref={globeRef}>
         <mesh position={[1.2, 1.2, 0.5]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#ef4444" />
         </mesh>
         <mesh position={[-1.2, -0.8, 1.0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#f59e0b" />
         </mesh>
         <mesh position={[0, 1.6, 0.8]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#ef4444" />
         </mesh>
         <mesh position={[0.8, -1.0, -1.2]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshBasicMaterial color="#10b981" />
         </mesh>
      </group>
    </group>
  );
}

export default App;
