import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { PhoneCall, CornerDownRight, PhoneForwarded, Link, Repeat, PhoneOff, Trash2, Settings, Plus, X, KeySquare } from 'lucide-react';

// ---------- Dagre Auto-Layout Helper ----------
const layoutNodes = (nodesToLayout, edgesToLayout) => {
  const nodeWidth = 260;
  const nodeHeight = 80;
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 100 });

  nodesToLayout.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edgesToLayout.forEach((edge) => {
    if (edge.source && edge.target) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  return nodesToLayout.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
};

// ---------- Action Palette (CLICK instead of DRAG) ----------
const ActionPalette = ({ onAddAction }) => {
  const actions = [
    { type: 'extension', label: 'Extension', icon: <PhoneForwarded size={16} />, lightBg: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200', darkBg: 'dark:bg-blue-950/40 dark:hover:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800/60' },
    { type: 'ring_group', label: 'Ring Group', icon: <PhoneForwarded size={16} />, lightBg: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200', darkBg: 'dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/60' },
    { type: 'submenu', label: 'Submenu', icon: <CornerDownRight size={16} />, lightBg: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200', darkBg: 'dark:bg-purple-950/40 dark:hover:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800/60' },
    { type: 'ivr', label: 'Route to IVR', icon: <Link size={16} />, lightBg: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200', darkBg: 'dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60' },
    { type: 'did_forward', label: 'DID Forward', icon: <PhoneCall size={16} />, lightBg: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200', darkBg: 'dark:bg-amber-950/40 dark:hover:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/60' },
    { type: 'external', label: 'External No.', icon: <PhoneCall size={16} />, lightBg: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200', darkBg: 'dark:bg-orange-950/40 dark:hover:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800/60' },
    { type: 'back', label: 'Go Back', icon: <CornerDownRight size={16} className="transform rotate-180" />, lightBg: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200', darkBg: 'dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    { type: 'repeat', label: 'Repeat Menu', icon: <Repeat size={16} />, lightBg: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200', darkBg: 'dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    { type: 'hangup', label: 'Hangup', icon: <PhoneOff size={16} />, lightBg: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200', darkBg: 'dark:bg-red-950/40 dark:hover:bg-red-950/70 dark:text-red-300 dark:border-red-900/60' },
  ];

  return (
    <div className="w-64 bg-white dark:bg-[#0c0d12] border-r border-gray-200 dark:border-white/10 shadow-sm p-4 flex flex-col gap-3 overflow-y-auto relative z-10">
      <div className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1">Actions</div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Click any block to add it directly to the IVR in sequence.</p>
      {actions.map((act) => (
        <button
          key={act.type}
          type="button"
          className={`flex items-center gap-3 p-3 ${act.lightBg} ${act.darkBg} border rounded-xl cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all w-full text-left focus:outline-none focus:ring-2 focus:ring-primary-500`}
          onClick={() => onAddAction && onAddAction(act.type)}
        >
          {act.icon}
          <span className="text-sm font-bold">{act.label}</span>
          <Plus size={14} className="ml-auto opacity-60" />
        </button>
      ))}
    </div>
  );
};

// ---------- Node Components ----------
const ActionNode = ({ data, selected }) => {
  return (
    <div className={`px-4 py-3 shadow-lg rounded-2xl bg-white dark:bg-[#121520] border-2 ${selected ? 'border-primary-500 ring-4 ring-primary-500/20' : data.borderColor || 'border-gray-200 dark:border-slate-700'} w-[260px] flex items-center gap-3 relative transition-all`}>
      <Handle type="target" position={Position.Top} className="!w-6 !h-6 !min-w-[24px] !min-h-[24px] !bg-slate-400 dark:!bg-slate-500 border-2 border-white dark:border-slate-800 hover:scale-125 hover:!bg-primary-400 transition-transform cursor-crosshair shadow-md" />
      <div className={`p-2.5 rounded-xl ${data.iconBgColor} ${data.iconColor}`}>
        {data.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">{data.label}</div>
        <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 truncate" title={data.subLabel || 'Unconfigured'}>
          {data.subLabel || <span className="text-rose-500 dark:text-rose-400 italic">Unconfigured</span>}
        </div>
      </div>
      {data.actionType === 'submenu' && (
        <Handle type="source" position={Position.Bottom} className="!w-6 !h-6 !min-w-[24px] !min-h-[24px] !bg-primary-500 border-2 border-white dark:border-slate-800 hover:scale-125 hover:!bg-primary-400 transition-transform cursor-crosshair shadow-md" />
      )}
    </div>
  );
};

const RootNode = ({ data, selected }) => {
  return (
    <div className={`px-4 py-3 shadow-xl rounded-2xl bg-white dark:bg-[#121520] border-2 ${selected ? 'border-primary-500 ring-4 ring-primary-500/20' : 'border-gray-800 dark:border-slate-600'} w-[260px] flex items-center gap-3 relative`}>
      <div className="p-2.5 rounded-xl bg-gray-900 dark:bg-primary-600 text-white shadow-sm">
        <PhoneCall size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">IVR Entry</div>
        <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 truncate">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-6 !h-6 !min-w-[24px] !min-h-[24px] !bg-primary-500 border-2 border-white dark:border-slate-800 hover:scale-125 hover:!bg-primary-400 transition-transform cursor-crosshair shadow-md" />
    </div>
  );
};

const nodeTypes = {
  actionNode: ActionNode,
  rootNode: RootNode,
};

const getActionDetails = (type) => {
  switch (type) {
    case 'extension': return { label: 'Extension', icon: <PhoneForwarded size={20} />, borderColor: 'border-blue-400 dark:border-blue-500/50', iconBgColor: 'bg-blue-50 dark:bg-blue-950/60', iconColor: 'text-blue-600 dark:text-blue-400' };
    case 'ring_group': return { label: 'Ring Group', icon: <PhoneForwarded size={20} />, borderColor: 'border-indigo-400 dark:border-indigo-500/50', iconBgColor: 'bg-indigo-50 dark:bg-indigo-950/60', iconColor: 'text-indigo-600 dark:text-indigo-400' };
    case 'submenu': return { label: 'Submenu', icon: <CornerDownRight size={20} />, borderColor: 'border-purple-400 dark:border-purple-500/50', iconBgColor: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-600 dark:text-purple-400' };
    case 'ivr': return { label: 'Route to IVR', icon: <Link size={20} />, borderColor: 'border-emerald-400 dark:border-emerald-500/50', iconBgColor: 'bg-emerald-50 dark:bg-emerald-950/60', iconColor: 'text-emerald-600 dark:text-emerald-400' };
    case 'did_forward':
    case 'forward': return { label: 'DID Forward', icon: <PhoneCall size={20} />, borderColor: 'border-amber-400 dark:border-amber-500/50', iconBgColor: 'bg-amber-50 dark:bg-amber-950/60', iconColor: 'text-amber-600 dark:text-amber-400' };
    case 'external': return { label: 'External No.', icon: <PhoneCall size={20} />, borderColor: 'border-orange-400 dark:border-orange-500/50', iconBgColor: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-600 dark:text-orange-400' };
    case 'back': return { label: 'Action', icon: <CornerDownRight size={20} className="transform rotate-180" />, borderColor: 'border-gray-400 dark:border-slate-600', iconBgColor: 'bg-gray-100 dark:bg-slate-800', iconColor: 'text-gray-600 dark:text-slate-300', subLabel: 'Go Back' };
    case 'repeat': return { label: 'Action', icon: <Repeat size={20} />, borderColor: 'border-gray-400 dark:border-slate-600', iconBgColor: 'bg-gray-100 dark:bg-slate-800', iconColor: 'text-gray-600 dark:text-slate-300', subLabel: 'Repeat Menu' };
    case 'hangup': return { label: 'Action', icon: <PhoneOff size={20} />, borderColor: 'border-red-400 dark:border-red-500/50', iconBgColor: 'bg-red-50 dark:bg-red-950/60', iconColor: 'text-red-600 dark:text-red-400', subLabel: 'Hangup' };
    default: return { label: 'Unknown', icon: <PhoneCall size={20} />, borderColor: 'border-gray-300 dark:border-slate-700', iconBgColor: 'bg-gray-100 dark:bg-slate-800', iconColor: 'text-gray-600 dark:text-slate-300' };
  }
};

let id = 0;
const getId = () => `dndnode_${id++}`;

// ---------- Main Builder ----------
const InteractiveBuilderCore = ({ ivrName, resources, initialMenu, onChange }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // Refs to access latest state inside callbacks (avoids stale closures)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const getSubLabel = (actionType, target, props) => {
    if (!target && !['submenu', 'back', 'repeat', 'hangup'].includes(actionType)) return 'Unconfigured';
    if (actionType === 'extension') return target || 'Unconfigured';
    if (actionType === 'ring_group') {
      const rg = resources.ringGroups?.find(r => r.id === target);
      return rg ? `${rg.name} (Ext: ${rg.extensionNumber})` : target || 'Unconfigured';
    }
    if (actionType === 'ivr') {
      const ivr = resources.ivrs?.find(i => i.id === target);
      return ivr ? ivr.name : target || 'Unconfigured';
    }
    if (actionType === 'external') {
      return target || 'Unconfigured';
    }
    if (actionType === 'did_forward' || actionType === 'forward') {
      const df = resources.didForwards?.find(d => d.id === target);
      return df ? `${df.name} (${df.destinationNumber})` : target || 'Unconfigured';
    }
    if (actionType === 'submenu') {
      return props?.greeting ? 'Has Greeting' : 'No Greeting';
    }
    if (actionType === 'back') return 'Go Back';
    if (actionType === 'repeat') return 'Repeat Menu';
    if (actionType === 'hangup') return 'Hangup';
    return target || 'Unconfigured';
  };

  // ---------- Initialize from initialMenu ----------
  useEffect(() => {
    if (!initialMenu || Object.keys(initialMenu).length === 0) {
      setNodes([{
        id: 'root',
        type: 'rootNode',
        data: { label: ivrName || 'Main Menu', actionType: 'submenu' },
        position: { x: 250, y: 50 },
      }]);
      setEdges([]);
      return;
    }

    const initialNodes = [];
    const initialEdges = [];

    initialNodes.push({
      id: 'root',
      type: 'rootNode',
      data: { label: ivrName || 'Main Menu', actionType: 'submenu' },
      position: { x: 0, y: 0 },
    });

    const traverseMenu = (menuObj, parentId) => {
      Object.entries(menuObj).forEach(([digit, action]) => {
        const nodeId = `${parentId}-${digit}`;
        const details = getActionDetails(action.type);
        const subLabel = getSubLabel(action.type, action.target, action.props);

        initialNodes.push({
          id: nodeId,
          type: 'actionNode',
          data: {
            actionType: action.type,
            target: action.target || '',
            props: action.props || {},
            ...details,
            subLabel
          },
          position: { x: 0, y: 0 },
        });

        initialEdges.push({
          id: `e-${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          data: { digit },
          label: `Press ${digit}`,
          labelBgPadding: [8, 5],
          labelBgBorderRadius: 8,
          labelBgStyle: { fill: 'var(--color-edge-bg, #ffffff)', stroke: 'var(--color-edge-border, #cbd5e1)', strokeWidth: 1.5, fillOpacity: 1 },
          labelStyle: { fill: 'var(--color-edge-text, #1e293b)', fontWeight: 800, fontSize: 13, fontFamily: 'inherit' },
          style: { stroke: 'var(--color-edge-line, #64748b)', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: '#64748b' },
        });

        if (action.type === 'submenu' && action.children) {
          traverseMenu(action.children, nodeId);
        }
      });
    };

    traverseMenu(initialMenu, 'root');

    const laidOut = layoutNodes(initialNodes, initialEdges);
    setNodes(laidOut);
    setEdges(initialEdges);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialMenu), ivrName]);

  // ---------- Click-to-Add Action ----------
  const handleAddAction = useCallback((actionType) => {
    const details = getActionDetails(actionType);
    const newNodeId = getId();
    const currentNodes = nodesRef.current || [];
    const currentEdges = edgesRef.current || [];

    // Find next available digit from root (1..9, 0, *, #)
    const usedDigits = currentEdges
      .filter(e => e.source === 'root')
      .map(e => e.data?.digit)
      .filter(Boolean);

    const allDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#'];
    const nextDigit = allDigits.find(d => !usedDigits.includes(d));

    if (!nextDigit) {
      alert('All keys (0-9, *, #) are already assigned. Remove an existing route before adding more.');
      return;
    }

    const subLabel = getSubLabel(actionType, '', {});

    const newNode = {
      id: newNodeId,
      type: 'actionNode',
      position: { x: 0, y: 0 },
      data: {
        actionType,
        target: '',
        props: {},
        ...details,
        subLabel,
      },
    };

    const newEdge = {
      id: `e-root-${newNodeId}`,
      source: 'root',
      target: newNodeId,
      data: { digit: nextDigit },
      label: `Press ${nextDigit}`,
      labelBgPadding: [8, 5],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: 'var(--color-edge-bg, #ffffff)', stroke: 'var(--color-edge-border, #cbd5e1)', strokeWidth: 1.5, fillOpacity: 1 },
      labelStyle: { fill: 'var(--color-edge-text, #1e293b)', fontWeight: 800, fontSize: 13, fontFamily: 'inherit' },
      style: { stroke: 'var(--color-edge-line, #64748b)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: '#64748b' },
    };

    const updatedNodes = currentNodes.concat(newNode);
    const updatedEdges = currentEdges.concat(newEdge);
    const laidOutNodes = layoutNodes(updatedNodes, updatedEdges);

    setNodes(laidOutNodes);
    setEdges(updatedEdges);

    // Auto-select newly added node so config panel opens immediately
    setSelectedNode({ ...newNode, data: { ...newNode.data } });

    // Smooth-fit the view to include the new node
    setTimeout(() => {
      if (reactFlowInstance) {
        try {
          reactFlowInstance.fitView({ padding: 0.25, duration: 300 });
        } catch (e) { }
      }
    }, 80);
  }, [reactFlowInstance, setNodes, setEdges]);

  // ---------- Existing Connect / Delete flows ----------
  const onConnect = useCallback((params) => {
    setPendingConnection(params);
  }, []);

  const confirmConnection = (digit) => {
    if (!pendingConnection) return;
    const newEdge = {
      ...pendingConnection,
      id: `e-${pendingConnection.source}-${pendingConnection.target}`,
      data: { digit },
      label: `Press ${digit}`,
      labelBgPadding: [8, 5],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: 'var(--color-edge-bg, #ffffff)', stroke: 'var(--color-edge-border, #cbd5e1)', strokeWidth: 1.5, fillOpacity: 1 },
      labelStyle: { fill: 'var(--color-edge-text, #1e293b)', fontWeight: 800, fontSize: 13, fontFamily: 'inherit' },
      style: { stroke: 'var(--color-edge-line, #64748b)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: '#64748b' },
    };
    setEdges((eds) => addEdge(newEdge, eds));
    setPendingConnection(null);
  };

  const cancelConnection = () => setPendingConnection(null);

  const onEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    setPendingDelete(edge);
  }, []);

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  const updateNodeData = (nodeId, newData) => {
    setNodes((nds) => nds.map(node => {
      if (node.id === nodeId) {
        const updatedData = { ...node.data, ...newData };
        updatedData.subLabel = getSubLabel(updatedData.actionType, updatedData.target, updatedData.props);
        return { ...node, data: updatedData };
      }
      return node;
    }));

    setSelectedNode(prev => {
      if (prev && prev.id === nodeId) {
        const updatedData = { ...prev.data, ...newData };
        updatedData.subLabel = getSubLabel(updatedData.actionType, updatedData.target, updatedData.props);
        return { ...prev, data: updatedData };
      }
      return prev;
    });
  };

  const handleUpdateDigit = (nodeId, newDigit) => {
    const targetEdge = edges.find(e => e.target === nodeId);
    if (!targetEdge) return;

    // Check if this digit is already used by another action from the SAME parent/source
    const isAlreadyAssigned = edges.some(
      e => e.source === targetEdge.source && e.target !== nodeId && e.data?.digit === newDigit
    );

    if (isAlreadyAssigned) {
      alert(`Key "${newDigit}" is already assigned to another action in this menu! Each press key can only be assigned to a single action block.`);
      return;
    }

    setEdges((eds) => eds.map(edge => {
      if (edge.target === nodeId) {
        return {
          ...edge,
          data: { ...edge.data, digit: newDigit },
          label: `Press ${newDigit}`,
        };
      }
      return edge;
    }));
  };

  // ---------- Build backend JSON tree ----------
  useEffect(() => {
    const buildMenu = (parentId) => {
      const menu = {};
      const outgoingEdges = edges.filter(e => e.source === parentId);

      outgoingEdges.forEach(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!targetNode || !edge.data?.digit) return;

        const action = { type: targetNode.data.actionType };

        if (['extension', 'ring_group', 'ivr', 'external', 'did_forward', 'forward'].includes(action.type)) {
          action.target = targetNode.data.target;
        }

        if (action.type === 'submenu') {
          action.props = targetNode.data.props || {};
          action.children = buildMenu(targetNode.id);
        }

        menu[edge.data.digit] = action;
      });
      return menu;
    };

    const finalMenu = buildMenu('root');
    onChange(finalMenu);
  }, [nodes, edges, onChange]);

  return (
    <div className="flex h-[700px] bg-white dark:bg-[#07080c] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
      <ActionPalette onAddAction={handleAddAction} />

      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="currentColor" className="text-gray-300 dark:text-slate-800" gap={20} size={1} />
          <Controls className="!bg-white dark:!bg-[#121520] !border-gray-200 dark:!border-slate-800 !shadow-lg [&>button]:!bg-white dark:[&>button]:!bg-[#121520] [&>button]:!border-gray-200 dark:[&>button]:!border-slate-700/60 dark:[&>button]:!fill-slate-300 dark:[&>button_svg]:!fill-slate-300" />
        </ReactFlow>

        {/* Digit Selection Modal (kept for manual handle-to-handle connections) */}
        {pendingConnection && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0f111d] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/60 flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-xl">
                  <KeySquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Assign Key Route</h3>
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Select the digit the caller should press</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => {
                    const isUsed = edges.some(e => e.source === pendingConnection.source && e.data?.digit === digit);
                    return (
                      <button
                        key={digit}
                        onClick={() => confirmConnection(digit)}
                        disabled={isUsed}
                        className={`h-12 flex items-center justify-center text-xl font-bold rounded-xl transition-all ${isUsed
                            ? 'bg-gray-100 dark:bg-slate-800/40 text-gray-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-2 border-gray-200 dark:border-slate-700 hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/30 active:scale-95 shadow-sm'
                          }`}
                        title={isUsed ? `Key ${digit} is already assigned` : `Assign Key ${digit}`}
                      >
                        {digit}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={cancelConnection}
                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edge Click Modal: Change Key or Delete Route */}
        {pendingDelete && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0f111d] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/60 flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-xl">
                  <KeySquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Manage Route Key</h3>
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Change key or delete this connection</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-inner">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Current Route</span>
                  <span className="font-extrabold text-primary-600 dark:text-primary-400 text-base">{pendingDelete.label}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Change Key (Single Block Only)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#'].map(digit => {
                      const isUsed = edges.some(e => e.source === pendingDelete.source && e.target !== pendingDelete.target && e.data?.digit === digit);
                      const isCurrent = pendingDelete.data?.digit === digit;
                      return (
                        <button
                          key={digit}
                          type="button"
                          disabled={isUsed || isCurrent}
                          onClick={() => {
                            setEdges(eds => eds.map(e => e.id === pendingDelete.id ? {
                              ...e,
                              data: { ...e.data, digit },
                              label: `Press ${digit}`,
                            } : e));
                            setPendingDelete(null);
                          }}
                          className={`h-10 text-sm font-extrabold rounded-lg transition-all ${
                            isCurrent
                              ? 'bg-primary-600 text-white ring-2 ring-primary-300 dark:ring-primary-600 shadow-sm'
                              : isUsed
                              ? 'bg-gray-100 dark:bg-slate-800/40 text-gray-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                              : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-950/40 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-300'
                          }`}
                          title={isUsed ? `Key ${digit} is already assigned to another block` : `Set to Key ${digit}`}
                        >
                          {digit}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center gap-2">
                  <button
                    onClick={() => {
                      setEdges((eds) => eds.filter((e) => e.id !== pendingDelete.id));
                      setPendingDelete(null);
                    }}
                    className="px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Delete Route
                  </button>
                  <button
                    onClick={() => setPendingDelete(null)}
                    className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Panel */}
        {selectedNode && selectedNode.id !== 'root' && (
          <div className="absolute top-4 right-4 w-80 bg-white dark:bg-[#0f111d] shadow-2xl rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden z-10 animate-in slide-in-from-right-4 duration-200">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-gray-400 dark:text-slate-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Configure Action</h3>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-slate-200">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Press Key Selector */}
              {(() => {
                const incomingEdge = edges.find(e => e.target === selectedNode.id);
                if (!incomingEdge) return null;
                const currentDigit = incomingEdge.data?.digit;
                const usedDigitsBySiblings = edges
                  .filter(e => e.source === incomingEdge.source && e.target !== selectedNode.id)
                  .map(e => e.data?.digit)
                  .filter(Boolean);

                const validKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#'];

                return (
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                      <span>Caller Key (Press Option)</span>
                      <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold lowercase">single block only</span>
                    </label>
                    <select
                      className="w-full rounded-lg border-0 py-2 px-3 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-primary-600 sm:text-sm font-bold bg-white dark:bg-slate-800"
                      value={currentDigit || ''}
                      onChange={(e) => handleUpdateDigit(selectedNode.id, e.target.value)}
                    >
                      {validKeys.map((k) => {
                        const isTaken = usedDigitsBySiblings.includes(k);
                        return (
                          <option key={k} value={k} disabled={isTaken}>
                            Press {k} {isTaken ? '(Already in use by another block)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                      Keys already assigned cannot be reused in the same menu.
                    </p>
                  </div>
                );
              })()}

              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Action Type</label>
                <div className="text-sm font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-slate-800">
                  {selectedNode.data.label}
                </div>
              </div>

              {selectedNode.data.actionType === 'extension' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Select Extension</label>
                  <select
                    className="w-full rounded-lg border-0 py-2 px-3 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium bg-white dark:bg-slate-800"
                    value={selectedNode.data.target}
                    onChange={(e) => updateNodeData(selectedNode.id, { target: e.target.value })}
                  >
                    <option value="">Select Extension...</option>
                    {resources.extensions.map(ext => (
                      <option key={ext.id} value={ext.extensionNumber}>{ext.extensionNumber} - {ext.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedNode.data.actionType === 'ring_group' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Select Ring Group</label>
                  <select
                    className="w-full rounded-lg border-0 py-2 px-3 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium bg-white dark:bg-slate-800"
                    value={selectedNode.data.target}
                    onChange={(e) => updateNodeData(selectedNode.id, { target: e.target.value })}
                  >
                    <option value="">Select Ring Group...</option>
                    {resources.ringGroups.map(rg => (
                      <option key={rg.id} value={rg.id}>{rg.name} (Ext: {rg.extensionNumber})</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedNode.data.actionType === 'ivr' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Select IVR</label>
                  <select
                    className="w-full rounded-lg border-0 py-2 px-3 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium bg-white dark:bg-slate-800"
                    value={selectedNode.data.target}
                    onChange={(e) => updateNodeData(selectedNode.id, { target: e.target.value })}
                  >
                    <option value="">Select IVR...</option>
                    {resources.ivrs.map(ivr => (
                      <option key={ivr.id} value={ivr.id}>{ivr.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(selectedNode.data.actionType === 'did_forward' || selectedNode.data.actionType === 'forward') && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Select DID Forward</label>
                  <select
                    className="w-full rounded-lg border-0 py-2 px-3 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium bg-white dark:bg-slate-800"
                    value={selectedNode.data.target}
                    onChange={(e) => updateNodeData(selectedNode.id, { target: e.target.value })}
                  >
                    <option value="">Select DID Forward...</option>
                    {resources.didForwards?.map(df => (
                      <option key={df.id} value={df.id}>{df.name} ({df.destinationNumber})</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedNode.data.actionType === 'external' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">External Number</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-0 py-2 px-3 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium bg-white dark:bg-slate-800"
                    placeholder="+1234567890"
                    value={selectedNode.data.target || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { target: e.target.value })}
                  />
                </div>
              )}

              {selectedNode.data.actionType === 'submenu' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Submenu Greeting</label>
                  <select
                    className="w-full rounded-lg border-0 py-2 px-3 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium bg-white dark:bg-slate-800"
                    value={selectedNode.data.props?.greeting || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { props: { ...selectedNode.data.props, greeting: e.target.value } })}
                  >
                    <option value="">-- No Audio --</option>
                    {resources.audioFiles.map(file => (
                      <option key={file.id} value={file.storageUrl}>{file.name}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">Use handles on submenu node to add options inside it.</p>
                </div>
              )}

              {['back', 'repeat', 'hangup'].includes(selectedNode.data.actionType) && (
                <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400 font-medium">
                  {selectedNode.data.actionType === 'hangup' && 'This action will immediately terminate the call.'}
                  {selectedNode.data.actionType === 'repeat' && 'This action will replay the current menu greeting and prompts.'}
                  {selectedNode.data.actionType === 'back' && 'This action will return the caller to the parent menu level.'}
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  className="w-full inline-flex justify-center items-center rounded-lg px-3 py-2 text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 transition-colors"
                  onClick={() => {
                    setNodes((nds) => nds.filter(n => n.id !== selectedNode.id));
                    setEdges((eds) => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                    setSelectedNode(null);
                  }}
                >
                  <Trash2 size={16} className="mr-2" /> Delete Node
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function InteractiveIVRBuilder(props) {
  return (
    <ReactFlowProvider>
      <InteractiveBuilderCore {...props} />
    </ReactFlowProvider>
  );
}