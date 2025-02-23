"use client"

import React, { createContext, useContext, useState } from 'react';
import ReactFlow, { Controls, Background, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';

// API key của Google Gemini (hardcode cho ví dụ; nên lưu trong biến môi trường)
const GEMINI_API_KEY = "AIzaSyBifaWH4R8VeJ9WyxqyRnP33lsSNCkv0Zc"; // Replace with your actual Gemini API key

// Tạo Context để quản lý state toàn cục
const IdeaContext = createContext(null);

const IdeaProvider = ({ children }: { children: React.ReactNode }) => {
    // Danh sách ý tưởng người dùng nhập (raw input)
    const [ideas, setIdeas] = useState<string[]>([]);
    // Graph được tạo từ kết quả của LLM (thực thể và kết nối)
    const [graph, setGraph] = useState({ nodes: [], edges: [] });
    // Danh sách gợi ý ý tưởng mới từ LLM
    const [suggestions, setSuggestions] = useState<string[]>([]);
    // Lưu trữ kết quả raw trả về từ LLM để debug
    const [rawLLMOutput, setRawLLMOutput] = useState<any>(null);

    // Hàm sắp xếp node theo dạng lưới để tránh chồng lấn
    const layoutNodes = (entities: { id: string; label: string }[]) => {
        const nodeWidth = 200;
        const nodeHeight = 100;
        const gapX = 50;
        const gapY = 50;
        const containerWidth = 800;
        const nodesPerRow = Math.floor(containerWidth / (nodeWidth + gapX)) || 1;
        return entities.map((entity, index) => {
            const row = Math.floor(index / nodesPerRow);
            const col = index % nodesPerRow;
            return {
                id: entity.id,
                data: { label: entity.label },
                position: {
                    x: col * (nodeWidth + gapX),
                    y: row * (nodeHeight + gapY)
                }
            };
        });
    };

    /**
     * Gọi API Google Gemini với danh sách ý tưởng hiện tại.
     */
    const callGoogleGemini = async (ideasList: string[]) => {
        const prompt = `You are a brainstorming assistant. Given a list of ideas, your task is twofold:

1. Suggest New Ideas: Generate a list of new, unique ideas that are relevant to the provided list.
   Return these suggestions as a JSON array under the key 'suggestions'.

2. Organize Ideas into a Mind Map: Analyze the provided list of ideas and generate a simple mind map.
   - Extract abstract ENTITIES representing the core concepts from the ideas. Each ENTITY should have an 'id' and a 'label'.
   - Connect these entities to show associations. Represent these connections as objects with an 'id', 'source' (entity id), and 'target' (entity id). Do not include any relationship type.
   - **Ensure that the mind map does not include any loop connections (where the source and target are the same) and that each child node has only one parent. If multiple parent connections exist for a single node, include only the first connection.**

Return the result in JSON format with the following structure:
{
  "suggestions": ["New Idea 1", "New Idea 2", ...],
  "mindmap": {
      "entities": [{"id": "1", "label": "Entity Label 1"}, {"id": "2", "label": "Entity Label 2"}, ...],
      "connections": [{"id": "c1", "source": "1", "target": "2"}, ...]
  }
}

Current list of ideas:
${ideasList.join('\n')}

Ensure the output is a single JSON object containing both 'suggestions' and 'mindmap', and return it without any markdown formatting like \`\`\`json.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const body = {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ]
        };
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            console.log("Raw LLM Output:", data);
            setRawLLMOutput(data);

            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
                let outputText = data.candidates[0].content.parts[0].text;

                if (outputText.startsWith('```json')) {
                    outputText = outputText.substring(7);
                }
                if (outputText.endsWith('```')) {
                    outputText = outputText.substring(0, outputText.length - 3);
                }

                try {
                    const parsedOutput = JSON.parse(outputText);
                    return parsedOutput;
                } catch (parseError) {
                    console.error("Error parsing JSON output from LLM:", parseError);
                    console.error("Raw output that failed to parse:", outputText);
                    return { suggestions: [], mindmap: { entities: [], connections: [] } };
                }
            } else {
                console.error("Unexpected response structure from Google Gemini:", data);
                return { suggestions: [], mindmap: { entities: [], connections: [] } };
            }
        } catch (error) {
            console.error("Error calling Google Gemini API:", error);
            return { suggestions: [], mindmap: { entities: [], connections: [] } };
        }
    };

    /**
     * updateIdeas: Cập nhật danh sách ý tưởng và gọi Google Gemini để lấy gợi ý
     * và tổ chức lại danh sách thành MIND MAP.
     */
    const updateIdeas = async (newIdeas: string[]) => {
        setIdeas(newIdeas);
        const llmResult = await callGoogleGemini(newIdeas);
        setSuggestions(llmResult.suggestions || []);
        const mindmap = llmResult.mindmap || { entities: [], connections: [] };
        const entities = mindmap.entities || [];
        const connections = mindmap.connections || [];

        // Lọc các kết nối để đảm bảo: 
        // - Không có self-loop (cha và con là cùng một node)
        // - Một con chỉ có duy nhất 1 cha (nếu có nhiều, chỉ lấy kết nối đầu tiên)
        const filteredConnections: any[] = [];
        const childAssigned = new Set();
        connections.forEach((conn: any) => {
            if (conn.source === conn.target) return; // Loại bỏ self-loop
            if (childAssigned.has(conn.target)) return; // Nếu con đã có cha rồi thì bỏ qua
            childAssigned.add(conn.target);
            filteredConnections.push(conn);
        });

        // Áp dụng thuật toán sắp xếp node theo dạng lưới
        const nodes = layoutNodes(entities);
        const edges = filteredConnections.map((conn: any) => ({
            id: conn.id,
            source: conn.source,
            target: conn.target
        }));
        setGraph({ nodes, edges });
    };

    // Hàm thêm ý tưởng mới
    const addIdea = async (newIdea: string) => {
        const updatedIdeas = [...ideas, newIdea];
        await updateIdeas(updatedIdeas);
    };

    // Hàm sửa ý tưởng tại vị trí index
    const editIdea = async (index: number, newIdea: string) => {
        const updatedIdeas = ideas.map((idea, i) => (i === index ? newIdea : idea));
        await updateIdeas(updatedIdeas);
    };

    // Hàm xóa ý tưởng tại vị trí index
    const deleteIdea = async (index: number) => {
        const updatedIdeas = ideas.filter((_, i) => i !== index);
        await updateIdeas(updatedIdeas);
    };

    // Xử lý cập nhật vị trí của node khi kéo thả
    const handleNodesChange = (changes: any) => {
        setGraph(prevGraph => ({
            ...prevGraph,
            nodes: applyNodeChanges(changes, prevGraph.nodes)
        }));
    };

    const value = {
        ideas,
        addIdea,
        editIdea,
        deleteIdea,
        suggestions,
        graph,
        rawLLMOutput,
        handleNodesChange
    };

    return (
        <IdeaContext.Provider value={value}>
            {children}
        </IdeaContext.Provider>
    );
};

const useIdeaContext = () => useContext(IdeaContext);

const IdeaInput = () => {
    const [inputValue, setInputValue] = useState('');
    const { addIdea } = useIdeaContext();

    const handleAddIdea = async () => {
        if (inputValue.trim() === '') return;
        await addIdea(inputValue);
        setInputValue('');
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            <input
                type="text"
                placeholder="Nhập ý tưởng mới..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                style={{ width: '300px', marginRight: '10px' }}
            />
            <button onClick={handleAddIdea}>Thêm Ý Tưởng</button>
        </div>
    );
};

const IdeaList = () => {
    const { ideas, editIdea, deleteIdea } = useIdeaContext();

    return (
        <div style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "20px" }}>
            <h3>Danh sách ý tưởng:</h3>
            {ideas.length === 0 ? (
                <p>Chưa có ý tưởng nào.</p>
            ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                    {ideas.map((idea, index) => (
                        <li key={index} style={{ marginBottom: "8px", display: "flex", alignItems: "center" }}>
                            <span style={{ flex: 1 }}>{idea}</span>
                            <button
                                onClick={async () => {
                                    const newIdea = window.prompt("Sửa ý tưởng:", idea);
                                    if (newIdea) {
                                        await editIdea(index, newIdea);
                                    }
                                }}
                                style={{ marginRight: "5px" }}
                            >
                                Sửa
                            </button>
                            <button
                                onClick={async () => {
                                    if (window.confirm("Bạn có chắc muốn xóa ý tưởng này?")) {
                                        await deleteIdea(index);
                                    }
                                }}
                            >
                                Xóa
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const SuggestionList = () => {
    const { suggestions, addIdea } = useIdeaContext();

    return (
        <div style={{ marginBottom: '20px' }}>
            <h3>Gợi ý ý tưởng từ LLM:</h3>
            {suggestions && suggestions.map((sugg, index) => (
                <div key={index} style={{ marginBottom: '5px' }}>
                    <span>{sugg}</span>
                    <button onClick={async () => await addIdea(sugg)} style={{ marginLeft: '10px' }}>
                        Thêm
                    </button>
                </div>
            ))}
        </div>
    );
};

const GraphDisplay = () => {
    const { graph, handleNodesChange } = useIdeaContext();

    return (
        <div style={{ height: '500px', border: '1px solid #ccc' }}>
            <ReactFlow 
                nodes={graph.nodes} 
                edges={graph.edges} 
                onNodesChange={handleNodesChange}
                fitView 
                nodesDraggable={true}
            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};

const Page = () => {
    return (
        <IdeaProvider>
            <div style={{ padding: '20px' }}>
                <h1>Ứng dụng Brainstorming với React Flow & Google Gemini</h1>
                <IdeaInput />
                <IdeaList />
                <SuggestionList />
                <GraphDisplay />
                {/* <DebugOutput /> */}
            </div>
        </IdeaProvider>
    );
};

export default Page;
