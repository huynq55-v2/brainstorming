"use client"

import React, { useState, useCallback } from "react";
import ReactFlow, {
    ReactFlowProvider,
    MiniMap,
    Controls,
    Background,
    Edge,
    Node as RFNode,
} from "reactflow";
import "reactflow/dist/style.css";

// Định nghĩa kiểu cho node tùy chỉnh, bao gồm thông tin nhãn và parentId
interface CustomNode extends RFNode {
    data: {
        label: string;
        parentId?: string;
    };
}

// Khởi tạo node gốc của mindmap
const initialNodes: CustomNode[] = [
    {
        id: "1",
        data: { label: "MindMap Root" },
        position: { x: 250, y: 50 },
    },
];

const initialEdges: Edge[] = [];

const MindMapFlow = () => {
    const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [childText, setChildText] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);

    // Khi người dùng click vào node, lưu lại node được chọn và cập nhật giá trị edit
    const onNodeClick = useCallback((event: React.MouseEvent, node: CustomNode) => {
        setSelectedNodeId(node.id);
        setEditLabel(node.data.label);
        setSuggestions([]); // reset gợi ý khi chọn node mới
    }, []);

    // Hàm tính chuỗi branch từ node được chọn (từ gốc đến node hiện tại)
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

    // Cập nhật nhãn của node đã chọn
    const handleUpdateLabel = () => {
        setNodes((prev) =>
            prev.map((n) =>
                n.id === selectedNodeId ? { ...n, data: { ...n.data, label: editLabel } } : n
            )
        );
    };

    // Thêm node con mới cho node đã chọn
    const handleAddChild = (label: string) => {
        if (!selectedNodeId) return;
        const parentNode = nodes.find((n) => n.id === selectedNodeId);
        if (!parentNode) return;
        // Tính số lượng node con hiện có để tính vị trí node con mới
        const childCount = nodes.filter((n) => n.data.parentId === parentNode.id).length;
        const newId = Date.now().toString();
        const newNode: CustomNode = {
            id: newId,
            data: { label, parentId: parentNode.id },
            position: { x: parentNode.position.x + 200, y: parentNode.position.y + (childCount + 1) * 80 },
        };
        setNodes((prev) => [...prev, newNode]);
        setEdges((prev) => [
            ...prev,
            { id: `${parentNode.id}-${newId}`, source: parentNode.id, target: newId },
        ]);
        setChildText("");
    };

    // Hàm parseSuggestions sử dụng regex để trích xuất các chuỗi nằm giữa ** **
    const parseSuggestions = (text: string): string[] => {
        const regex = /\*\*(.+?)\*\*/g;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push(match[1].replace(/:/g, "").trim()); // Xóa dấu ":" nếu có
        }
        return matches;
      };      

    const handleSuggestChild = async () => {
        if (!selectedNodeId) return;
        const branch = computeBranch(selectedNodeId);
        // Gửi toàn bộ chuỗi branch, bao gồm cả ký tự "->"
        // Và lưu ý rằng node gốc là node đầu tiên trong chuỗi (ví dụ: "Ha Noi")
        const prompt = `
      You are an AI assistant specializing in generating hierarchical mind map suggestions.

The current branch is: "${branch}".
The root node is the first element in this branch (which is "${branch.split(" -> ")[0]}").

Your task is to generate a list of relevant child nodes that logically extend this topic.

**Output Format Requirements:**
- Each suggested child node **MUST** be enclosed within double asterisks (**), e.g., **Bún chả**.
- Do **NOT** include any additional explanations, descriptions, or bullet points. Only return a pure list of child nodes formatted as required.
- The output **MUST NOT** contain colons or any extra symbols.

Now, generate the list of child nodes based on the branch: "${branch}".
        `;

        console.log("Prompt gửi đi:", prompt);
        try {
            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBifaWH4R8VeJ9WyxqyRnP33lsSNCkv0Zc",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [{ text: prompt }],
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

            // Cập nhật code để parse theo cấu trúc trả về mới: data.candidates
            const suggestionsText =
                data.candidates && data.candidates[0]?.content?.parts[0]?.text
                    ? data.candidates[0].content.parts[0].text
                    : "";
            if (!suggestionsText) {
                console.warn("Không có dữ liệu gợi ý từ API");
                return;
            }

            // Sử dụng hàm parseSuggestions để tách lấy danh sách gợi ý
            const suggestionList = parseSuggestions(suggestionsText);
            console.log("Danh sách gợi ý:", suggestionList);
            setSuggestions(suggestionList);
        } catch (error) {
            console.error("Lỗi khi gọi API LLM:", error);
        }
    };

    // Xoá node đã chọn và toàn bộ node con của nó
    const handleDeleteNode = () => {
        if (!selectedNodeId) return;
        // Đệ quy thu thập tất cả id của subtree
        const getSubtreeIds = (nodeId: string): string[] => {
            let ids = [nodeId];
            const children = nodes.filter((n) => n.data.parentId === nodeId);
            children.forEach((child) => {
                ids = ids.concat(getSubtreeIds(child.id));
            });
            return ids;
        };
        const idsToDelete = getSubtreeIds(selectedNodeId);
        setNodes((prev) => prev.filter((n) => !idsToDelete.includes(n.id)));
        setEdges((prev) =>
            prev.filter((e) => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target))
        );
        setSelectedNodeId(null);
        setSuggestions([]);
    };

    return (
        <div style={{ height: "100vh", display: "flex" }}>
            <ReactFlowProvider>
                <div style={{ flex: 1 }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodeClick={onNodeClick}
                        fitView
                    >
                        <MiniMap />
                        <Controls />
                        <Background />
                    </ReactFlow>
                </div>
                <div style={{ width: "300px", padding: "10px", borderLeft: "1px solid #ccc" }}>
                    <h3>Chi tiết Node</h3>
                    {selectedNodeId ? (
                        <>
                            <div>
                                <strong>Branch:</strong>
                                <div>{computeBranch(selectedNodeId)}</div>
                            </div>
                            <div style={{ marginTop: "10px" }}>
                                <label>Chỉnh sửa nhãn:</label>
                                <input
                                    type="text"
                                    value={editLabel}
                                    onChange={(e) => setEditLabel(e.target.value)}
                                    style={{ width: "100%" }}
                                />
                                <button onClick={handleUpdateLabel} style={{ marginTop: "5px", width: "100%" }}>
                                    Cập nhật
                                </button>
                            </div>
                            <div style={{ marginTop: "10px" }}>
                                <label>Tạo node con (nhập văn bản):</label>
                                <input
                                    type="text"
                                    value={childText}
                                    onChange={(e) => setChildText(e.target.value)}
                                    style={{ width: "100%" }}
                                />
                                <button
                                    onClick={() => handleAddChild(childText)}
                                    style={{ marginTop: "5px", width: "100%" }}
                                >
                                    Thêm node con
                                </button>
                            </div>
                            <div style={{ marginTop: "10px" }}>
                                <button onClick={handleSuggestChild} style={{ width: "100%" }}>
                                    Gợi ý node con (LLM)
                                </button>
                            </div>
                            {suggestions.length > 0 && (
                                <div style={{ marginTop: "10px" }}>
                                    <strong>Gợi ý:</strong>
                                    <ul>
                                        {suggestions.map((s, index) => (
                                            <li
                                                key={index}
                                                onClick={() => handleAddChild(s)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div style={{ marginTop: "10px" }}>
                                <button
                                    onClick={handleDeleteNode}
                                    style={{ width: "100%", background: "red", color: "#fff" }}
                                >
                                    Xoá node (các node con)
                                </button>
                            </div>
                        </>
                    ) : (
                        <div>Chọn một node để thao tác</div>
                    )}
                </div>
            </ReactFlowProvider>
        </div>
    );
};

const MindMapPage = () => {
    return <MindMapFlow />;
};

export default MindMapPage;
