#include <emscripten/bind.h>
#include <vector>
#include <string>
#include <algorithm>
#include <iostream>

using namespace emscripten;
using namespace std;

struct LogStep {
    string action; 
    int indexA;
    int indexB;
    string info;
};

class HeapBackend {
private:
    vector<int> heap;
    bool isMinHeap;

    int parent(int i) { return (i - 1) / 2; }
    int left(int i) { return (2 * i) + 1; }
    int right(int i) { return (2 * i) + 2; }

    bool compare(int a, int b) {
        if (isMinHeap) return a < b; 
        else return a > b;
    }

    void swapNodes(int i, int j) {
        logs.push_back({"highlight", i, j, "Comparing..."});
        int temp = heap[i];
        heap[i] = heap[j];
        heap[j] = temp;
        logs.push_back({"swap", i, j, "Swapping"});
    }

    void heapifyUp(int i) {
        while (i != 0 && compare(heap[i], heap[parent(i)])) {
            swapNodes(i, parent(i));
            i = parent(i);
        }
    }

    void heapifyDown(int i) {
        int extreme = i; 
        int l = left(i);
        int r = right(i);

        if (l < heap.size() && compare(heap[l], heap[extreme])) extreme = l;
        if (r < heap.size() && compare(heap[r], heap[extreme])) extreme = r;

        if (extreme != i) {
            swapNodes(i, extreme);
            heapifyDown(extreme);
        }
    }

    vector<LogStep> logs;

public:
    HeapBackend() : isMinHeap(true) {}

    void setMode(bool minMode) {
        isMinHeap = minMode;
        heap.clear();
    }

    vector<LogStep> insert(int key) {
        logs.clear();
        heap.push_back(key);
        int index = heap.size() - 1;
        logs.push_back({"insert", index, key, "Inserted"});
        heapifyUp(index);
        logs.push_back({"complete", -1, -1, "Done"});
        return logs;
    }

    vector<LogStep> extract() {
        logs.clear();
        if (heap.size() == 0) return logs;

        int lastIndex = heap.size() - 1;
        logs.push_back({"highlight", 0, lastIndex, "Swap Root with Last"});
        
        int rootVal = heap[0];
        heap[0] = heap[lastIndex];
        heap[lastIndex] = rootVal;
        logs.push_back({"swap", 0, lastIndex, "Removing Root"});

        logs.push_back({"extract", lastIndex, rootVal, "Extracted"});
        heap.pop_back();

        if (heap.size() > 0) heapifyDown(0);
        
        logs.push_back({"complete", -1, -1, "Done"});
        return logs;
    }

    vector<int> getArray() { return heap; }
};

EMSCRIPTEN_BINDINGS(heap_module) {
    value_object<LogStep>("LogStep")
        .field("action", &LogStep::action)
        .field("indexA", &LogStep::indexA)
        .field("indexB", &LogStep::indexB)
        .field("info", &LogStep::info);

    register_vector<LogStep>("VectorLogStep");
    register_vector<int>("VectorInt");

    class_<HeapBackend>("HeapBackend")
        .constructor<>()
        .function("setMode", &HeapBackend::setMode)
        .function("insert", &HeapBackend::insert)
        .function("extract", &HeapBackend::extract)
        .function("getArray", &HeapBackend::getArray);
}