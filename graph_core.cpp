#include <emscripten/bind.h>
#include <vector>
#include <map>
#include <queue>
#include <stack>
#include <string>
#include <iostream>

using namespace emscripten;
using namespace std;

// Structure to pass visual commands to JS
struct LogStep {
    string action; // "visit", "push", "pop", "update_dist", "highlight_edge"
    int nodeA;
    int nodeB; 
    string info;   // Text to display (e.g. "Dist: 5")
};

class GraphBackend {
private:
    // Adjacency List: map<Node, vector<pair<Neighbor, Weight>>>
    map<int, vector<pair<int, int>>> adjList;

public:
    GraphBackend() {}

    void addVertex(int id) {
        if (adjList.find(id) == adjList.end()) {
            adjList[id] = vector<pair<int, int>>();
        }
    }

    void addEdge(int u, int v, int weight) {
        addVertex(u);
        addVertex(v);
        adjList[u].push_back(make_pair(v, weight));
        adjList[v].push_back(make_pair(u, weight));
    }

    void removeVertex(int id) {
        adjList.erase(id);
        // Manual removal from neighbors without <algorithm>
        for (auto& pair : adjList) {
            vector<std::pair<int, int>>& neighbors = pair.second;
            for (int i = 0; i < neighbors.size(); i++) {
                if (neighbors[i].first == id) {
                    // Swap with last and pop back to avoid shifting
                    neighbors[i] = neighbors.back();
                    neighbors.pop_back();
                    i--; 
                }
            }
        }
    }

    // --- BFS ---
    vector<LogStep> runBFS(int startNode) {
        vector<LogStep> logs;
        if (adjList.find(startNode) == adjList.end()) return logs;

        map<int, bool> visited;
        queue<int> q;

        visited[startNode] = true;
        q.push(startNode);
        logs.push_back({"push", startNode, -1, "Start"});

        while (!q.empty()) {
            int curr = q.front();
            q.pop();
            logs.push_back({"pop", curr, -1, ""});
            logs.push_back({"visit", curr, -1, ""});

            vector<pair<int, int>> neighbors = adjList[curr];
            for (size_t i = 0; i < neighbors.size(); i++) {
                int neighbor = neighbors[i].first;
                if (!visited[neighbor]) {
                    visited[neighbor] = true;
                    q.push(neighbor);
                    logs.push_back({"push", neighbor, -1, ""});
                    logs.push_back({"highlight_edge", curr, neighbor, ""});
                }
            }
        }
        return logs;
    }

    // --- DFS ---
    vector<LogStep> runDFS(int startNode) {
        vector<LogStep> logs;
        if (adjList.find(startNode) == adjList.end()) return logs;

        map<int, bool> visited;
        stack<int> s;

        s.push(startNode);
        logs.push_back({"push", startNode, -1, "Start"});

        while (!s.empty()) {
            int curr = s.top();
            s.pop();
            logs.push_back({"pop", curr, -1, ""});

            if (!visited[curr]) {
                visited[curr] = true;
                logs.push_back({"visit", curr, -1, ""});

                vector<pair<int, int>> neighbors = adjList[curr];
                // Iterate backwards for stack to process in intuitive order (optional)
                for (int i = neighbors.size() - 1; i >= 0; i--) {
                    int neighbor = neighbors[i].first;
                    if (!visited[neighbor]) {
                        s.push(neighbor);
                        logs.push_back({"push", neighbor, -1, ""});
                        logs.push_back({"highlight_edge", curr, neighbor, ""});
                    }
                }
            }
        }
        return logs;
    }

    // --- Dijkstra ---
    vector<LogStep> runDijkstra(int startNode) {
        vector<LogStep> logs;
        map<int, int> dist;
        
        for (auto const& [node, neighbors] : adjList) {
            dist[node] = 999999; 
            logs.push_back({"update_dist", node, -1, "INF"});
        }
        dist[startNode] = 0;
        logs.push_back({"update_dist", startNode, -1, "0"});

        // Min-Priority Queue {dist, node}
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        pq.push({0, startNode});
        logs.push_back({"push", startNode, -1, "d:0"});

        while (!pq.empty()) {
            int u = pq.top().second;
            int d = pq.top().first;
            pq.pop();
            logs.push_back({"pop", u, -1, ""});

            if (d > dist[u]) continue;

            logs.push_back({"visit", u, -1, ""});

            for (auto& edge : adjList[u]) {
                int v = edge.first;
                int weight = edge.second;

                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    pq.push({dist[v], v});
                    
                    logs.push_back({"update_dist", v, -1, to_string(dist[v])});
                    logs.push_back({"push", v, -1, "d:" + to_string(dist[v])});
                    logs.push_back({"highlight_edge", u, v, ""}); // Candidate edge
                }
            }
        }
        return logs;
    }

    // --- Prim's (MST) ---
    vector<LogStep> runPrim(int startNode) {
        vector<LogStep> logs;
        map<int, bool> inMST;
        map<int, int> key;
        map<int, int> parent;

        for (auto const& [node, neighbors] : adjList) {
            key[node] = 999999;
            inMST[node] = false;
            logs.push_back({"update_dist", node, -1, "Key: INF"}); // Reusing 'update_dist' for Key visual
        }

        key[startNode] = 0;
        logs.push_back({"update_dist", startNode, -1, "Key: 0"});
        
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        pq.push({0, startNode});
        logs.push_back({"push", startNode, -1, "k:0"});

        while(!pq.empty()) {
            int u = pq.top().second;
            pq.pop();
            logs.push_back({"pop", u, -1, ""});

            if(inMST[u]) continue;
            inMST[u] = true;
            logs.push_back({"visit", u, -1, ""});

            if(parent.count(u)) {
                logs.push_back({"highlight_edge", parent[u], u, "MST"});
            }

            for (auto& edge : adjList[u]) {
                int v = edge.first;
                int weight = edge.second;

                if (!inMST[v] && weight < key[v]) {
                    key[v] = weight;
                    parent[v] = u;
                    pq.push({key[v], v});
                    
                    logs.push_back({"update_dist", v, -1, "Key: " + to_string(key[v])});
                    logs.push_back({"push", v, -1, "k:" + to_string(key[v])});
                }
            }
        }
        return logs;
    }
};

// --- Emscripten Bindings ---
EMSCRIPTEN_BINDINGS(my_module) {
    value_object<LogStep>("LogStep")
        .field("action", &LogStep::action)
        .field("nodeA", &LogStep::nodeA)
        .field("nodeB", &LogStep::nodeB)
        .field("info", &LogStep::info);

    register_vector<LogStep>("VectorLogStep");

    class_<GraphBackend>("GraphBackend")
        .constructor<>()
        .function("addVertex", &GraphBackend::addVertex)
        .function("addEdge", &GraphBackend::addEdge)
        .function("removeVertex", &GraphBackend::removeVertex)
        .function("runBFS", &GraphBackend::runBFS)
        .function("runDFS", &GraphBackend::runDFS)
        .function("runDijkstra", &GraphBackend::runDijkstra)
        .function("runPrim", &GraphBackend::runPrim);
}