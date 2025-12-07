#include <emscripten/bind.h>
#include <vector>
#include <string>
#include <iostream>

using namespace emscripten;
using namespace std;

struct Node {
    int key;
    Node* next;
    Node(int k) : key(k), next(nullptr) {}
};

struct LogStep {
    string action; // "compute_hash", "traverse", "insert", "duplicate", "found", "not_found"
    int bucketIdx; 
    int keyVal;    
    string info;
};

struct BucketSnapshot {
    int index;
    vector<int> keys;
};

class HashTableBackend {
private:
    static const int TABLE_SIZE = 10;
    vector<Node*> table;
    vector<LogStep> logs;

    int hashFunction(int key) {
        return key % TABLE_SIZE;
    }

public:
    HashTableBackend() {
        for (int i = 0; i < TABLE_SIZE; i++) table.push_back(nullptr);
    }

    ~HashTableBackend() {
        for (int i = 0; i < TABLE_SIZE; i++) {
            Node* curr = table[i];
            while (curr) {
                Node* temp = curr;
                curr = curr->next;
                delete temp;
            }
        }
    }

    vector<LogStep> insert(int key) {
        logs.clear();
        int index = hashFunction(key);
        logs.push_back({"compute_hash", index, key, "Hash: " + to_string(key) + " % 10 = " + to_string(index)});

        // 1. Check if Empty
        if (table[index] == nullptr) {
            table[index] = new Node(key);
            logs.push_back({"insert", index, key, "Inserted as Head"});
            return logs;
        }

        // 2. Traverse & Check Duplicates
        Node* curr = table[index];
        
        // Check Head first
        if (curr->key == key) {
            logs.push_back({"duplicate", index, key, "Duplicate Key Ignored"});
            return logs;
        }

        while (curr->next != nullptr) {
            logs.push_back({"traverse", index, curr->key, "Traversing " + to_string(curr->key)});
            if (curr->next->key == key) {
                logs.push_back({"duplicate", index, key, "Duplicate Key Ignored"});
                return logs;
            }
            curr = curr->next;
        }

        // 3. Insert at Tail
        logs.push_back({"traverse", index, curr->key, "Reached Tail"});
        curr->next = new Node(key);
        logs.push_back({"insert", index, key, "Inserted at Tail"});
        
        return logs;
    }

    vector<LogStep> search(int key) {
        logs.clear();
        int index = hashFunction(key);
        logs.push_back({"compute_hash", index, key, "Searching Bucket " + to_string(index)});

        Node* curr = table[index];
        while (curr != nullptr) {
            logs.push_back({"traverse", index, curr->key, "Checking " + to_string(curr->key)});
            if (curr->key == key) {
                logs.push_back({"found", index, key, "Found Key " + to_string(key)});
                return logs;
            }
            curr = curr->next;
        }

        logs.push_back({"not_found", index, key, "Key Not Found"});
        return logs;
    }

    vector<BucketSnapshot> getSnapshot() {
        vector<BucketSnapshot> snapshot;
        for (int i = 0; i < TABLE_SIZE; i++) {
            BucketSnapshot bs;
            bs.index = i;
            Node* curr = table[i];
            while (curr != nullptr) {
                bs.keys.push_back(curr->key);
                curr = curr->next;
            }
            snapshot.push_back(bs);
        }
        return snapshot;
    }
};

EMSCRIPTEN_BINDINGS(hash_module) {
    value_object<LogStep>("LogStep")
        .field("action", &LogStep::action)
        .field("bucketIdx", &LogStep::bucketIdx)
        .field("keyVal", &LogStep::keyVal)
        .field("info", &LogStep::info);

    value_object<BucketSnapshot>("BucketSnapshot")
        .field("index", &BucketSnapshot::index)
        .field("keys", &BucketSnapshot::keys);

    register_vector<LogStep>("VectorLogStep");
    register_vector<int>("VectorInt");
    register_vector<BucketSnapshot>("VectorBucketSnapshot");

    class_<HashTableBackend>("HashTableBackend")
        .constructor<>()
        .function("insert", &HashTableBackend::insert)
        .function("search", &HashTableBackend::search)
        .function("getSnapshot", &HashTableBackend::getSnapshot);
}