#include <emscripten/bind.h>
#include <vector>
#include <string>
#include <algorithm>
#include <iostream>

using namespace emscripten;
using namespace std;

// --- Data Structures ---

struct Node {
    int key;
    int height;
    Node* left;
    Node* right;

    Node(int k) : key(k), height(1), left(nullptr), right(nullptr) {}
};

struct LogStep {
    string action; // "search_visit", "insert_node", "highlight_node", "rotate_event", "update_stats"
    int key;       // The node key involved
    string info;   // Extra text (e.g. "BF: 2")
};

struct NodeData {
    int key;
    int height;
    int bf;
    int leftKey;  // -1 if null
    int rightKey; // -1 if null
};

// --- AVL Logic Class ---

class AVLBackend {
private:
    Node* root;
    vector<LogStep> logs; // Record actions here

    int height(Node* N) {
        if (N == nullptr) return 0;
        return N->height;
    }

    int getBalance(Node* N) {
        if (N == nullptr) return 0;
        return height(N->left) - height(N->right);
    }

    void updateHeight(Node* N) {
        if (N != nullptr)
            N->height = 1 + max(height(N->left), height(N->right));
    }

    // --- Rotations ---

    Node* rightRotate(Node* y) {
        logs.push_back({"rotate_event", y->key, "Performing Right Rotate (LL Case)"});
        Node* x = y->left;
        Node* T2 = x->right;

        // Perform rotation
        x->right = y;
        y->left = T2;

        updateHeight(y);
        updateHeight(x);

        return x;
    }

    Node* leftRotate(Node* x) {
        logs.push_back({"rotate_event", x->key, "Performing Left Rotate (RR Case)"});
        Node* y = x->right;
        Node* T2 = y->left;

        // Perform rotation
        y->left = x;
        x->right = T2;

        updateHeight(x);
        updateHeight(y);

        return y;
    }

    // --- Insert ---

    Node* insertNode(Node* node, int key) {
        // 1. Normal BST Insert
        if (node == nullptr) {
            logs.push_back({"insert_node", key, "Inserted"});
            return new Node(key);
        }

        logs.push_back({"search_visit", node->key, ""}); // Visualizing the path

        if (key < node->key)
            node->left = insertNode(node->left, key);
        else if (key > node->key)
            node->right = insertNode(node->right, key);
        else 
            return node; // No duplicates allowed

        // 2. Update Height
        updateHeight(node);

        // 3. Get Balance Factor
        int balance = getBalance(node);
        logs.push_back({"update_stats", node->key, "H:" + to_string(node->height) + " BF:" + to_string(balance)});

        // 4. Balance the tree (4 Cases)

        // Left Left Case
        if (balance > 1 && key < node->left->key)
            return rightRotate(node);

        // Right Right Case
        if (balance < -1 && key > node->right->key)
            return leftRotate(node);

        // Left Right Case
        if (balance > 1 && key > node->left->key) {
            logs.push_back({"rotate_event", node->left->key, "Left Rotate (LR Prep)"});
            node->left = leftRotate(node->left);
            return rightRotate(node);
        }

        // Right Left Case
        if (balance < -1 && key < node->right->key) {
            logs.push_back({"rotate_event", node->right->key, "Right Rotate (RL Prep)"});
            node->right = rightRotate(node->right);
            return leftRotate(node);
        }

        return node;
    }

    // --- Delete (Min Value Node Helper) ---
    Node* minValueNode(Node* node) {
        Node* current = node;
        while (current->left != nullptr)
            current = current->left;
        return current;
    }

    Node* deleteNode(Node* root, int key) {
        if (root == nullptr) return root;

        logs.push_back({"search_visit", root->key, ""});

        if (key < root->key)
            root->left = deleteNode(root->left, key);
        else if (key > root->key)
            root->right = deleteNode(root->right, key);
        else {
            // Node found
            if ((root->left == nullptr) || (root->right == nullptr)) {
                Node* temp = root->left ? root->left : root->right;
                if (temp == nullptr) {
                    temp = root;
                    root = nullptr;
                } else
                    *root = *temp;
                delete temp;
                logs.push_back({"insert_node", key, "Deleted"}); // Reuse action for visual removal
            } else {
                Node* temp = minValueNode(root->right);
                root->key = temp->key;
                logs.push_back({"highlight_node", root->key, "Replaced with Successor"});
                root->right = deleteNode(root->right, temp->key);
            }
        }

        if (root == nullptr) return root;

        updateHeight(root);
        int balance = getBalance(root);
        logs.push_back({"update_stats", root->key, "H:" + to_string(root->height) + " BF:" + to_string(balance)});

        // Balancing (Similar to Insert)
        if (balance > 1 && getBalance(root->left) >= 0)
            return rightRotate(root);

        if (balance > 1 && getBalance(root->left) < 0) {
            root->left = leftRotate(root->left);
            return rightRotate(root);
        }

        if (balance < -1 && getBalance(root->right) <= 0)
            return leftRotate(root);

        if (balance < -1 && getBalance(root->right) > 0) {
            root->right = rightRotate(root->right);
            return leftRotate(root);
        }

        return root;
    }

    // --- Serialization for JS ---
    void serialize(Node* node, vector<NodeData>& out) {
        if (node == nullptr) return;
        NodeData d;
        d.key = node->key;
        d.height = node->height;
        d.bf = getBalance(node);
        d.leftKey = (node->left) ? node->left->key : -1;
        d.rightKey = (node->right) ? node->right->key : -1;
        out.push_back(d);
        
        serialize(node->left, out);
        serialize(node->right, out);
    }

public:
    AVLBackend() : root(nullptr) {}

    vector<LogStep> insert(int key) {
        logs.clear();
        root = insertNode(root, key);
        return logs;
    }

    vector<LogStep> remove(int key) {
        logs.clear();
        root = deleteNode(root, key);
        return logs;
    }

    // Returns a flattened list of all nodes so JS can draw the tree easily
    vector<NodeData> getTreeStructure() {
        vector<NodeData> out;
        serialize(root, out);
        return out;
    }
};

// --- Bindings ---
EMSCRIPTEN_BINDINGS(avl_module) {
    value_object<LogStep>("LogStep")
        .field("action", &LogStep::action)
        .field("key", &LogStep::key)
        .field("info", &LogStep::info);

    value_object<NodeData>("NodeData")
        .field("key", &NodeData::key)
        .field("height", &NodeData::height)
        .field("bf", &NodeData::bf)
        .field("leftKey", &NodeData::leftKey)
        .field("rightKey", &NodeData::rightKey);

    register_vector<LogStep>("VectorLogStep");
    register_vector<NodeData>("VectorNodeData");

    class_<AVLBackend>("AVLBackend")
        .constructor<>()
        .function("insert", &AVLBackend::insert)
        .function("remove", &AVLBackend::remove)
        .function("getTreeStructure", &AVLBackend::getTreeStructure);
}