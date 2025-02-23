"use client"

import React, { useState } from "react";
import ReactFlow, {
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  Edge,
  Node as RFNode,
  Handle,
  Position,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

// Định nghĩa kiểu cho node tùy chỉnh
interface CustomNode extends RFNode {
  data: {
    label: string;
    parentId?: string;
    onEdit?: (nodeId: string) => void;
    onAdd?: (nodeId: string) => void;
    onDelete?: (nodeId: string) => void;
    onSuggest?: (nodeId: string) => void;
  };
}

const initialNodes: CustomNode[] = [
  {
    id: "1",
    type: "custom",
    data: { label: "MindMap Root" },
    position: { x: 50, y: 50 },
  },
];

const initialEdges: Edge[] = [];

// Hàm tính layout lại cho các node tránh chồng lấn
const recalcLayout = (nodes: CustomNode[]): CustomNode[] => {
  const horizontalGap = 200;
  const verticalGap = 80;
  let currentY = 50;
  const newNodes = nodes.map((n) => ({ ...n, position: { ...n.position } }));
  const layout = (node: CustomNode, depth: number) => {
    node.position.x = 50 + depth * horizontalGap;
    node.position.y = currentY;
    currentY += verticalGap;
    const children = newNodes.filter((n) => n.data.parentId === node.id);
    children.sort((a, b) => a.id.localeCompare(b.id));
    children.forEach((child) => layout(child, depth + 1));
  };
  const roots = newNodes.filter((n) => !n.data.parentId);
  roots.sort((a, b) => a.id.localeCompare(b.id));
  roots.forEach((root) => layout(root, 0));
  return newNodes;
};

// Định nghĩa style cho các nút hành động
const buttonContainerStyle: React.CSSProperties = {
  position: "absolute",
  top: "2px",
  right: "2px",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  zIndex: 10,
};

const buttonStyle: React.CSSProperties = {
  padding: "2px 4px",
  fontSize: "10px",
  borderRadius: "3px",
  border: "none",
  cursor: "pointer",
};

// Nút Sửa node (màu vàng)
const editButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#FFC107",
  color: "#fff",
};

// Nút Thêm node con (màu xanh lá)
const addButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#4CAF50",
  color: "#fff",
};

// Nút Xoá node (màu đỏ)
const deleteButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#F44336",
  color: "#fff",
};

// Nút Gợi ý AI (màu xanh dương)
const aiButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#2196F3",
  color: "#fff",
};

// Custom node component với 4 nút hành động
const CustomNodeComponent = ({ id, data }: NodeProps) => {
  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.onEdit) data.onEdit(id);
  };

  const handleAdd = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.onAdd) data.onAdd(id);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.onDelete) data.onDelete(id);
  };

  const handleSuggest = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.onSuggest) data.onSuggest(id);
  };

  return (
    <div
      style={{
        padding: "10px",
        border: "1px solid #ddd",
        borderRadius: "5px",
        background: "#fff",
        position: "relative",
        minWidth: "140px",
      }}
    >
      <div>{data.label}</div>
      <div style={buttonContainerStyle}>
        <button onClick={handleEdit} style={editButtonStyle}>
          Sửa
        </button>
        <button onClick={handleAdd} style={addButtonStyle}>
          +
        </button>
        <button onClick={handleDelete} style={deleteButtonStyle}>
          -
        </button>
        <button onClick={handleSuggest} style={aiButtonStyle}>
          AI
        </button>
      </div>
      <Handle type="target" position={Position.Left} style={{ background: "#555" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#555" }} />
    </div>
  );
};

const nodeTypes = { custom: CustomNodeComponent };

const MindMapFlow = () => {
  const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  // Tính chuỗi branch từ node được chọn
  const computeBranch = (nodeId: string): string => {
    let branch: string[] = [];
    let current = nodes.find((n) => n.id === nodeId);
    while (current) {
      branch.unshift(current.data.label);
      if (!current.data.parentId) break;
      current = nodes.find((n) => n.id === current.data.parentId);
    }
    return branch.join(" -> ");
  };

  // Xây dựng cấu trúc mindmap dạng cây
  const buildMindMapString = (): string => {
    const buildTree = (node: CustomNode, indent: string): string => {
      let result = indent + node.data.label + "\n";
      const children = nodes.filter((n) => n.data.parentId === node.id);
      children.sort((a, b) => a.id.localeCompare(b.id));
      children.forEach((child) => {
        result += buildTree(child, indent + "  ");
      });
      return result;
    };
    let mindMapStr = "";
    const roots = nodes.filter((n) => !n.data.parentId);
    roots.sort((a, b) => a.id.localeCompare(b.id));
    roots.forEach((root) => {
      mindMapStr += buildTree(root, "");
    });
    return mindMapStr;
  };

  // Hàm sửa nhãn cho node
  const handleEditNodeForNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newLabel = window.prompt("Nhập nhãn mới cho node:", node.data.label);
    if (newLabel && newLabel !== node.data.label) {
      const newNodes = nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
      );
      setNodes(recalcLayout(newNodes));
    }
  };

  // Hàm thêm node con cho node cha
  const handleAddChildForNode = (nodeId: string) => {
    const label = window.prompt("Nhập nhãn cho node con:");
    if (!label) return;
    const parentNode = nodes.find((n) => n.id === nodeId);
    if (!parentNode) return;
    const newId = Date.now().toString();
    const newNode: CustomNode = {
      id: newId,
      type: "custom",
      data: { label, parentId: parentNode.id },
      position: { x: 0, y: 0 },
    };
    const newNodes = recalcLayout([...nodes, newNode]);
    setNodes(newNodes);
    setEdges((prev) => [
      ...prev,
      { id: `${parentNode.id}-${newId}`, source: parentNode.id, target: newId },
    ]);
  };

  // Hàm xoá node và các node con của nó
  const handleDeleteNodeForNode = (nodeId: string) => {
    const getSubtreeIds = (nodeId: string): string[] => {
      let ids = [nodeId];
      const children = nodes.filter((n) => n.data.parentId === nodeId);
      children.forEach((child) => {
        ids = ids.concat(getSubtreeIds(child.id));
      });
      return ids;
    };
    const idsToDelete = getSubtreeIds(nodeId);
    const newNodes = recalcLayout(nodes.filter((n) => !idsToDelete.includes(n.id)));
    setNodes(newNodes);
    setEdges((prev) =>
      prev.filter((e) => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target))
    );
  };

  // Hàm parse danh sách gợi ý từ văn bản trả về của LLM
  const parseSuggestions = (text: string): string[] => {
    const regex = /\*\*(.+?)\*\*/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1].replace(/:/g, "").trim());
    }
    return matches;
  };

  // Hàm gọi API LLM để gợi ý node con
  const handleSuggestChildForNode = async (nodeId: string) => {
    const branch = computeBranch(nodeId);
    const mindMapStructure = buildMindMapString();
    const promptText = `
You are an AI assistant specializing in generating hierarchical mind map suggestions.

The current branch is: "${branch}".
The entire mind map is as follows:
${mindMapStructure}
The root node is the first element in this branch (which is "${branch.split(" -> ")[0]}").

Your task is to generate a list of relevant child nodes that logically extend this topic.

**Output Format Requirements:**
- Each suggested child node **MUST** be enclosed within double asterisks (**), e.g., **Bún chả**.
- Do **NOT** include any additional explanations, descriptions, or bullet points. Only return a pure list of child nodes formatted as required.
- The output **MUST NOT** contain colons or any extra symbols.

Now, generate the list of child nodes based on the branch: "${branch}".
        `;
    console.log("Prompt gửi đi:", promptText);
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBifaWH4R8VeJ9WyxqyRnP33lsSNCkv0Zc",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }],
              },
            ],
          }),
        }
      );
      if (!response.ok) {
        console.error("API trả về lỗi, status:", response.status);
        return;
      }
      const data = await response.json();
      console.log("Response từ API:", data);
      const suggestionsText =
        data.candidates && data.candidates[0]?.content?.parts[0]?.text
          ? data.candidates[0].content.parts[0].text
          : "";
      if (!suggestionsText) {
        console.warn("Không có dữ liệu gợi ý từ API");
        return;
      }
      const suggestionList = parseSuggestions(suggestionsText);
      console.log("Danh sách gợi ý:", suggestionList);
      if (suggestionList.length > 0) {
        const selectedSuggestion = window.prompt(
          "Gợi ý: " +
            suggestionList.join(", ") +
            "\nNhập lựa chọn để thêm node con:"
        );
        if (selectedSuggestion && suggestionList.includes(selectedSuggestion)) {
          const parentNode = nodes.find((n) => n.id === nodeId);
          if (!parentNode) return;
          const newId = Date.now().toString();
          const newNode: CustomNode = {
            id: newId,
            type: "custom",
            data: { label: selectedSuggestion, parentId: parentNode.id },
            position: { x: 0, y: 0 },
          };
          const newNodes = recalcLayout([...nodes, newNode]);
          setNodes(newNodes);
          setEdges((prev) => [
            ...prev,
            { id: `${parentNode.id}-${newId}`, source: parentNode.id, target: newId },
          ]);
        }
      }
    } catch (error) {
      console.error("Lỗi khi gọi API LLM:", error);
    }
  };

  // Nếu mindmap rỗng, hiển thị nút "+" ở giữa màn hình để thêm node gốc
  const handleAddRoot = () => {
    const label = window.prompt("Nhập nhãn cho node gốc:");
    if (!label) return;
    const newNode: CustomNode = {
      id: Date.now().toString(),
      type: "custom",
      data: { label },
      position: { x: 50, y: 50 },
    };
    setNodes(recalcLayout([newNode]));
    setEdges([]);
  };

  // Thêm các hàm hành động vào data của node
  const enhancedNodes = nodes.map((n) => ({
    ...n,
    type: "custom",
    data: {
      ...n.data,
      onEdit: handleEditNodeForNode,
      onAdd: handleAddChildForNode,
      onDelete: handleDeleteNodeForNode,
      onSuggest: handleSuggestChildForNode,
    },
  }));

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <ReactFlowProvider>
        <ReactFlow nodes={enhancedNodes} edges={edges} nodeTypes={nodeTypes} fitView>
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
        {nodes.length === 0 && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <button onClick={handleAddRoot} style={{ fontSize: "24px", padding: "10px 20px" }}>
              +
            </button>
          </div>
        )}
      </ReactFlowProvider>
    </div>
  );
};

const MindMapPage = () => {
  return <MindMapFlow />;
};

export default MindMapPage;
