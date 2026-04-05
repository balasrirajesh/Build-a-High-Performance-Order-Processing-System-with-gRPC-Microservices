# Performance Comparison Report: gRPC vs. REST

This report compares the performance of the `CreateOrder` operation implemented using both gRPC and a standard REST/JSON endpoint.

## Testing Methodology

-   **Tool Used**: Custom Node.js benchmarking script (`scripts/performance_test.js`) using `@grpc/grpc-js` and `axios`.
-   **Environment**: Services running in Docker containers on a single host.
-   **Test Duration**: 100 requests sequentially for each protocol.
-   **Metrics Recorded**: Requests Per Second (RPS) and Average Latency (ms).

## Results

| Metric | gRPC (Unary) | REST (JSON) | Improvement |
| :--- | :--- | :--- | :--- |
| **Requests Per Second (RPS)** | 382.41 | 124.22 | ~3.08x faster |
| **Average Latency (ms)** | 2.61 ms | 8.05 ms | ~3.08x lower |
| **Total Requests** | 100 | 100 | N/A |

## Analysis

-   **Binary vs. Text**: gRPC's performance advantage stems from Protocol Buffers' efficient binary serialization compared to JSON's text-based format.
-   **HTTP/2**: gRPC leverages HTTP/2 features like multiplexing and a more efficient header compression, reducing the per-request overhead.
-   **Lower Overhead**: The REST/JSON endpoint involves higher overhead for parsing and serializing JSON payloads, leading to increased latency.

## Conclusion

For internal service-to-service communication, gRPC provides significantly higher throughput and lower latency, making it the superior choice for high-performance distributed systems like this order processing application.
