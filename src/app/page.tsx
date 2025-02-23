"use client"

import React, { createContext, useContext, useState } from 'react';
import ReactFlow, { Controls, Background, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';

// API key của Google Gemini (hardcode cho ví dụ; nên lưu trong biến môi trường)
const GEMINI_API_KEY = "AIzaSyBifaWH4R8VeJ9WyxqyRnP33lsSNCkv0Zc"; // Replace with your actual Gemini API key

// Tạo Context để quản lý state toàn cục
const IdeaContext = createContext(null);

const treeLayout = (
  entities: { id: string; label: string }[],
  connections: { id: string; source: string; target: string }[]
) => {
  // Tạo bản đồ cho từng entity
  const entityMap = new Map<string, { id: string; label: string }>();
  entities.forEach(entity => entityMap.set(entity.id, entity));

  // Xây dựng map các con và map cha cho mỗi node
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  connections.forEach(conn => {
    if (conn.source === conn.target) return; // loại bỏ self-loop
    if (parentMap.has(conn.target)) return; // mỗi con chỉ có 1 cha duy nhất
    parentMap.set(conn.target, conn.source);
    if (!childrenMap.has(conn.source)) {
      childrenMap.set(conn.source, []);
    }
    childrenMap.get(conn.source).push(conn.target);
  });

  // Xác định các node gốc (không có cha)
  const roots = entities.filter(entity => !parentMap.has(entity.id));

  // Nếu có nhiều hơn 1 root, chọn root đầu tiên và gán cho các root khác kết nối từ root đầu tiên
  if (roots.length > 1) {
    const primaryRoot = roots[0];
    roots.slice(1).forEach(secondaryRoot => {
      parentMap.set(secondaryRoot.id, primaryRoot.id);
      if (!childrenMap.has(primaryRoot.id)) {
        childrenMap.set(primaryRoot.id, []);
      }
      childrenMap.get(primaryRoot.id).push(secondaryRoot.id);
    });
  }

  // Gán cấp (level) cho các node theo BFS
  const levelMap = new Map<string, number>();
  const queue: string[] = [];
  const root = entities.find(entity => !parentMap.has(entity.id)) || roots[0];
  levelMap.set(root.id, 0);
  queue.push(root.id);
  while (queue.length > 0) {
    const nodeId = queue.shift();
    const level = levelMap.get(nodeId);
    const children = childrenMap.get(nodeId) || [];
    children.forEach(childId => {
      levelMap.set(childId, level + 1);
      queue.push(childId);
    });
  }

  // Nhóm các node theo cấp
  const levels: { [key: number]: string[] } = {};
  levelMap.forEach((level, id) => {
    if (!levels[level]) {
      levels[level] = [];
    }
    levels[level].push(id);
  });

  // Cấu hình khoảng cách
  const verticalSpacing = 150; // khoảng cách giữa các cấp theo chiều dọc
  const canvasWidth = 800; // giả sử chiều rộng canvas là 800

  // Tính vị trí cho các node theo cấp
  const positions = new Map<string, { x: number; y: number }>();
  Object.keys(levels).forEach(levelKey => {
    const level = parseInt(levelKey);
    const nodesAtLevel = levels[level];
    const count = nodesAtLevel.length;
    nodesAtLevel.forEach((nodeId, index) => {
      const margin = canvasWidth / (count + 1);
      const x = margin * (index + 1);
      const y = level * verticalSpacing + 50; // thêm margin trên
      positions.set(nodeId, { x, y });
    });
  });

  return entities.map(entity => ({
    id: entity.id,
    data: { label: entity.label },
    position: positions.get(entity.id) || { x: canvasWidth / 2, y: 50 }
  }));
};

const IdeaProvider = ({ children }: { children: React.ReactNode }) => {
  // Danh sách ý tưởng người dùng nhập (raw input)
  const [ideas, setIdeas] = useState<string[]>([]);
  // Graph được tạo từ kết quả của LLM (thực thể và kết nối)
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  // Danh sách gợi ý ý tưởng mới từ LLM
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Lưu trữ kết quả raw trả về từ LLM để debug
  const [rawLLMOutput, setRawLLMOutput] = useState<any>(null);

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
   - **Ensure that the mind map does not include any loop connections (where the source and target are the same) and that each child node has only one parent. If multiple parent connections exist for a single node, include only the first connection. Additionally, ensure that there is only one root entity (i.e. only one entity without a parent).**

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

      if (
        data.candidates &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0].text
      ) {
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
      if (conn.source === conn.target) return;
      if (childAssigned.has(conn.target)) return;
      childAssigned.add(conn.target);
      filteredConnections.push(conn);
    });

    const nodes = treeLayout(entities, filteredConnections);
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
      </div>
    </IdeaProvider>
  );
};

export default Page;
