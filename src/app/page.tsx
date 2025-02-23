"use client"

import React, { useState, useRef, ChangeEvent } from "react";
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
        onApplySuggestions?: (nodeId: string, suggestions: string[]) => void;
        onCancelSuggestions?: (nodeId: string) => void;
        activeSuggestion?: string[];
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

const editButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#FFC107",
    color: "#fff",
};

const addButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#4CAF50",
    color: "#fff",
};

const deleteButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#F44336",
    color: "#fff",
};

const aiButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#2196F3",
    color: "#fff",
};

// Custom node component (nội dung bên trong node)
// Lưu ý: không gán thêm class "has-dropdown" ở đây
const CustomNodeComponent = ({ id, data }: NodeProps) => {
    const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);

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

    const toggleSelection = (suggestion: string) => {
        setSelectedSuggestions((prev) =>
            prev.includes(suggestion)
                ? prev.filter((s) => s !== suggestion)
                : [...prev, suggestion]
        );
    };

    const handleCancel = (event: React.MouseEvent) => {
        event.stopPropagation();
        setSelectedSuggestions([]);
        if (data.onCancelSuggestions) data.onCancelSuggestions(id);
    };

    const handleApply = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (data.onApplySuggestions) {
            data.onApplySuggestions(id, selectedSuggestions);
        }
        setSelectedSuggestions([]);
    };

    return (
        <div
            className="custom-node"
            style={{
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "5px",
                background: "#fff",
                position: "relative",
                minWidth: "140px",
            }}
        >
            <div style={{ fontWeight: "bold", color: "black" }}>{data.label}</div>
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
            {/* Dropdown gợi ý AI với multi-select và 2 nút hành động */}
            {data.activeSuggestion && data.activeSuggestion.length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 2px)",
                        right: "2px",
                        background: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: "3px",
                        zIndex: 99999,
                        padding: "4px",
                    }}
                >
                    {data.activeSuggestion.map((suggestion: string, index: number) => {
                        const isSelected = selectedSuggestions.includes(suggestion);
                        return (
                            <div
                                key={index}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelection(suggestion);
                                }}
                                style={{
                                    padding: "4px",
                                    cursor: "pointer",
                                    fontSize: "10px",
                                    borderBottom: "1px solid #eee",
                                    backgroundColor: isSelected ? "#e0e0e0" : "transparent",
                                }}
                            >
                                {suggestion}
                            </div>
                        );
                    })}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: "4px",
                        }}
                    >
                        <button
                            onClick={handleCancel}
                            style={{
                                ...buttonStyle,
                                backgroundColor: "#F44336",
                                color: "#fff",
                                flex: 1,
                                marginRight: "2px",
                            }}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleApply}
                            style={{
                                ...buttonStyle,
                                backgroundColor: "#4CAF50",
                                color: "#fff",
                                flex: 1,
                                marginLeft: "2px",
                            }}
                            disabled={selectedSuggestions.length === 0}
                        >
                            Áp dụng
                        </button>
                    </div>
                </div>
            )}
            <Handle type="target" position={Position.Left} style={{ background: "#555" }} />
            <Handle type="source" position={Position.Right} style={{ background: "#555" }} />
        </div>
    );
};

const nodeTypes = { custom: CustomNodeComponent };

const MindMapFlow = () => {
    const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [activeSuggestions, setActiveSuggestions] = useState<
        { nodeId: string; suggestions: string[] } | null
    >(null);
    const [summaryText, setSummaryText] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Xây dựng cấu trúc mind map dạng cây
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
                        contents: [{ parts: [{ text: promptText }] }],
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
            const regex = /\*\*(.+?)\*\*/g;
            const suggestionList: string[] = [];
            let match;
            while ((match = regex.exec(suggestionsText)) !== null) {
                suggestionList.push(match[1].replace(/:/g, "").trim());
            }
            console.log("Danh sách gợi ý:", suggestionList);
            if (suggestionList.length > 0) {
                setActiveSuggestions({ nodeId, suggestions: suggestionList });
            }
        } catch (error) {
            console.error("Lỗi khi gọi API LLM:", error);
        }
    };

    // Hàm xử lý khi áp dụng các gợi ý đã tích chọn
    const handleApplySuggestionsForNode = (nodeId: string, suggestions: string[]) => {
        const parentNode = nodes.find((n) => n.id === nodeId);
        if (!parentNode) return;
        let newNodes = [...nodes];
        let newEdges = [...edges];
        suggestions.forEach((suggestion) => {
            const newId = Date.now().toString() + Math.random().toString();
            const newNode: CustomNode = {
                id: newId,
                type: "custom",
                data: { label: suggestion, parentId: parentNode.id },
                position: { x: 0, y: 0 },
            };
            newNodes.push(newNode);
            newEdges.push({ id: `${parentNode.id}-${newId}`, source: parentNode.id, target: newId });
        });
        setNodes(recalcLayout(newNodes));
        setEdges(newEdges);
        setActiveSuggestions(null);
    };

    const handleCancelSuggestionsForNode = (nodeId: string) => {
        setActiveSuggestions(null);
    };

    // Hàm tạo node gốc khi mind map rỗng
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

    // Hàm Lưu mind map: tạo file JSON tải xuống
    const handleSaveMindMap = () => {
        const data = { nodes, edges };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mindmap.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    // Hàm Tải mind map: mở hộp thoại chọn file và cập nhật state
    const handleLoadMindMap = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target?.result;
                if (typeof result === "string") {
                    const data = JSON.parse(result);
                    if (data.nodes && data.edges) {
                        setNodes(recalcLayout(data.nodes));
                        setEdges(data.edges);
                    } else {
                        alert("File không hợp lệ.");
                    }
                }
            } catch (err) {
                alert("Không thể tải file.");
            }
        };
        reader.readAsText(file);
    };

    // Hàm gọi API LLM để tóm tắt mind map (gửi toàn bộ JSON)
    const handleSummarizeMindMap = async () => {
        const mindMapData = { nodes, edges };
        const promptText = `
You are an AI assistant specializing in analyzing mind maps.
The following is the JSON data of a mind map:
${JSON.stringify(mindMapData, null, 2)}
Analyze the content presented in the mind map in detail and generate a textual content based on the provided mindmap.
`;
        console.log("Prompt tóm tắt:", promptText);
        try {
            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBifaWH4R8VeJ9WyxqyRnP33lsSNCkv0Zc",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }],
                    }),
                }
            );
            if (!response.ok) {
                console.error("API trả về lỗi, status:", response.status);
                return;
            }
            const data = await response.json();
            console.log("Response tóm tắt:", data);
            const summary =
                data.candidates && data.candidates[0]?.content?.parts[0]?.text
                    ? data.candidates[0].content.parts[0].text
                    : "";
            setSummaryText(summary);
        } catch (error) {
            console.error("Lỗi khi gọi API LLM tóm tắt:", error);
        }
    };

    // Thêm các hàm hành động vào data của node và gán class cho outer container nếu cần
    const enhancedNodes = nodes.map((n) => {
        const isActive = activeSuggestions && activeSuggestions.nodeId === n.id;
        return {
            ...n,
            type: "custom",
            className: isActive ? "has-dropdown" : "",
            data: {
                ...n.data,
                onEdit: handleEditNodeForNode,
                onAdd: handleAddChildForNode,
                onDelete: handleDeleteNodeForNode,
                onSuggest: handleSuggestChildForNode,
                onApplySuggestions: handleApplySuggestionsForNode,
                onCancelSuggestions: handleCancelSuggestionsForNode,
                activeSuggestion: isActive ? activeSuggestions!.suggestions : undefined,
            },
        };
    });

    return (
        <div style={{ display: "flex", height: "100vh" }}>
            {/* Sidebar chứa nội dung tóm tắt */}
            <div
                style={{
                    width: "250px",
                    borderRight: "1px solid #ddd",
                    padding: "10px",
                    overflowY: "auto",
                }}
            >
                <h4>Tóm tắt MindMap</h4>
                <textarea
                    value={summaryText}
                    readOnly
                    style={{ width: "100%", height: "90%", resize: "none", fontWeight: "bold", color: "black" }}
                />
            </div>
            {/* Container chứa ReactFlow và thanh công cụ */}
            <div style={{ flex: 1, position: "relative" }}>
                {/* Thanh công cụ: Lưu, Tải, Tóm tắt */}
                <div
                    style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        zIndex: 1000,
                        display: "flex",
                        gap: "10px",
                    }}
                >
                    <button
                        onClick={handleSaveMindMap}
                        style={{
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor: "#007bff",
                            color: "#fff",
                        }}
                    >
                        Lưu
                    </button>
                    <button
                        onClick={handleLoadMindMap}
                        style={{
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor: "#28a745",
                            color: "#fff",
                        }}
                    >
                        Tải
                    </button>
                    <button
                        onClick={handleSummarizeMindMap}
                        style={{
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor: "#9C27B0",
                            color: "#fff",
                        }}
                    >
                        Tóm tắt
                    </button>
                    {/* Input file ẩn để tải mind map */}
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                    />
                </div>
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={enhancedNodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        fitView
                    >
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
        </div>
    );
};

const MindMapPage = () => {
    return <MindMapFlow />;
};

export default MindMapPage;
