# Building a Vertex AI RAG System


Architecting Production-Grade Conversational AI: A Vertex AI and Firebase Blueprint for Retrieval-Augmented Generation (RAG)


I. Executive Summary: Establishing the Enterprise RAG Mandate

The decision to replace a rudimentary Gemini chat backend marks a critical pivot from basic generative AI experimentation to building an enterprise-grade, production-ready system. Un-grounded Large Language Models (LLMs) rely solely on their pre-trained knowledge, which is often outdated, incomplete, or entirely unaware of proprietary domain knowledge.1 This limitation frequently results in factual inaccuracies, commonly termed hallucinations. Retrieval-Augmented Generation (RAG) is the foundational architectural pattern employed to overcome these deficiencies.

1. Modernizing the Gemini Backend: Why RAG is Essential for Enterprise Chat

RAG systems combine the generative capabilities of LLMs with high-fidelity, external information retrieval components, such as vector databases and search engines.2 By retrieving relevant knowledge chunks from a proprietary knowledge base and inserting them directly into the LLM’s prompt, RAG ensures that responses are context-aware, accurate, and factually grounded in specific enterprise data.1
The adoption of a RAG architecture is driven by several critical functional requirements:
Accuracy and Trust: The primary goal is minimizing hallucinations by basing responses on verifiable information, a process enhanced by providing explicit citations to the source documents used for grounding.1
Data Freshness and Maintainability: RAG offers a scalable and cost-effective solution because data sources can be updated (ingested and indexed) without necessitating the expensive and time-consuming retraining of the base LLM.3
Enterprise Grounding: The core mandate involves securely connecting the generative AI model to the organization’s private documentation and domain-specific datasets, leveraging powerful services within the Google Cloud ecosystem, notably Vertex AI.5

2. Key Non-Functional Requirements (NFRs) for Production Readiness

A RAG implementation targeting production deployment must satisfy stringent non-functional requirements to ensure reliability, performance, and security under high load:
Scalability and Elasticity: The system must be designed using serverless components (e.g., Cloud Run) and managed, autoscaling services (e.g., Vertex AI Vector Search) to accommodate significant fluctuations in concurrent user traffic reliably.6
Low Perceived Latency: For an interactive chat user experience (UX), low latency is essential. This is achieved through optimization of the retrieval step, including potentially employing advanced post-retrieval strategies like re-ranking 8, and critically, the mandatory implementation of response streaming from the LLM endpoint to the client.9
Security and Access Control: The architecture must enforce the principle of least privilege. Strict IAM governance is required to secure the Cloud Run backend API, which acts as a security perimeter, preventing direct, unauthorized access to sensitive proprietary data and high-value Vertex AI model endpoints.6
Observability and Traceability: To facilitate continuous quality improvement and MLOps, the execution pipeline must be fully observable. This includes monitoring the performance of the generative core and, crucially, tracing the RAG workflow to determine which retrieved chunks were accessed and utilized during prompt augmentation, aiding in continuous evaluation and refinement.12

II. Component Deep Dive: Vertex AI RAG Spectrum and Architectural Choices

Google Cloud Platform (GCP) provides developers with a spectrum of RAG and grounding solutions, ranging in complexity and required development effort.1 The selection of the RAG implementation style—fully managed or highly customized—is the primary architectural decision that dictates the subsequent component choices and operational workload.

1. Vertex AI RAG Engine: The Managed Orchestration Path

The Vertex AI RAG Engine is presented as a managed orchestration service, specifically designed to simplify and streamline the complex process of retrieving and feeding relevant information to the LLM.1 It functions as a managed service, abstracting away significant infrastructure and operational challenges.
This service manages infrastructure complexities such as efficient vector storage (often relying on RagManagedDB) and handles the standard orchestration of the retrieval steps.12 This approach offers several advantages: rapid prototyping, ease of use through a simple API 1, and the flexibility to adapt to existing architectures by choosing preferred models and data sources.15
For highly complex, large-scale enterprise use cases requiring superior out-of-the-box quality, comprehensive data source connectivity, and fine-grained access controls, the RAG Engine integrates seamlessly with Vertex AI Search. Vertex AI Search acts as a robust, fully managed search engine and retriever API, simplifying the connection to diverse data sources like Cloud Storage, Google Drive, Jira, and Slack.1
The primary consequence of choosing the managed RAG Engine approach is the trade-off inherent in abstraction. While the service provides built-in solutions for efficient vector storage and optimal retrieval strategies, significantly accelerating deployment and minimizing operational overhead, it inherently limits the developer's ability to implement highly specific, customized logic. For instance, developers seeking to integrate a proprietary vector database, implement highly specific document-based chunking rules, or deploy sophisticated, novel post-retrieval re-ranking algorithms might find the managed layer restrictive. This solution is generally optimal when standardization, speed, and reduced operational burden are the highest priorities.

2. The DIY RAG Architecture: Achieving Maximum Granularity and Control

For projects demanding absolute control over every step of the RAG pipeline—from chunking to retrieval logic—the Fully DIY RAG approach is utilized. This relies on coordinating individual component APIs provided by Vertex AI.1
The core components of the DIY approach are:
Retrieval and Storage: Vertex AI Vector Search (VARS) serves as the central, scalable vector similarity-matching service. It is responsible for storing the high-dimensional vectors, managing the index, and performing low-latency vector search.6
Embedding Generation: The Vertex AI Text Embedding API is utilized consistently to generate the vector representations of the text, ensuring a uniform semantic space for both the indexed data and the runtime query.6
Grounding Flexibility: This path supports diverse grounding mechanisms. Beyond connecting to VARS, the system can utilize other enterprise search APIs, such as Elasticsearch or any custom search endpoint, by implementing a "Grounding with your search API" strategy.5
In the DIY model, Cloud Run assumes an elevated role, transitioning from a simple API proxy to the central orchestration engine.6 This architectural choice carries a secondary implication regarding development complexity: the Cloud Run service must contain the complex application logic necessary for orchestrating the entire runtime sequence. This means the Cloud Run service must manage conversation history, perform query embedding, coordinate the VARS lookup, execute custom re-ranking and deduplication algorithms on retrieved results 8, and finally construct the complex, context-augmented prompt.6 This significantly increases the burden of application maintenance and requires a more comprehensive MLOps strategy for the service layer itself.

III. Phase I: The Knowledge Ingestion and Indexing Pipeline

The quality of the RAG system is inextricably linked to the design and execution of the data ingestion pipeline, which converts raw enterprise data into an optimized, searchable index. This process must be robust, repeatable, and adaptable to different document structures.

1. Data Preparation and Chunking Strategies

The process begins with document preparation, where raw data is converted into discrete, manageable units, or chunks, for vectorization.

Chunking and Context Preservation

Effective chunking is arguably the most influential factor determining the relevance and precision of information retrieval. If chunks are too large, they may exceed the context limits of the embedding model and introduce irrelevant noise. If they are too small, critical context linking ideas may be lost, leading to poor retrieval results.18 Vertex AI Search offers robust preprocessing capabilities, including layout parser add-ons (such as Gemini layout parsing), which facilitate content-aware chunking by recognizing structural elements like tables and images.20

Strategic Chunking Techniques

To manage the trade-off between semantic precision and contextual breadth, several strategies are employed:
Fixed-Size/Token Chunking: This is the most basic strategy, splitting documents purely by character or token count. It typically uses a defined chunk overlap (e.g., 256 tokens) to ensure continuity between adjacent chunks and prevent semantic boundaries from being severed.18 While simple, this approach risks breaking logical or semantic units.19 The default chunk size in Vertex AI RAG Engine is 1,024 tokens.18
Document-Based Chunking: This essential technique leverages the intrinsic structure of the document. For highly structured data (e.g., technical manuals, contracts, or source code), the document is parsed using format-specific elements—splitting by headings in Markdown, specific HTML tags, or functions/classes in code.19 This ensures that logical blocks of content are preserved as single chunks, maximizing retrieval coherence.
Recursive Splitting: This method repeatedly attempts to split text using a sequence of defined separators (e.g., double newline, single newline, sentence, word) until the resulting chunks fit the target size constraints, often preserving more structure than a simple fixed-size split.19
A smaller chunk size yields more precise embeddings, while a larger chunk might yield a more general embedding, risking the loss of specific details.18 Consistency in the chosen chunking strategy across the knowledge base is vital for optimal workflow management.17
Table: Comparative Analysis of Production Chunking Strategies

2. Vectorization, Indexing, and Metadata Management

Once the documents are chunked, the next step is conversion into vectors and indexing for rapid search.

Consistency in Vectorization

A foundational requirement for high-quality RAG is consistency in the embedding model. Enterprises must utilize the same embedding model (e.g., a Vertex AI Text Embedding model) throughout the entire workflow—both during the initial ingestion phase and for runtime query vectorization.17 Discrepancies in the models used will lead to misaligned vector spaces, severely degrading retrieval performance.

Building and Deploying the Index

The generated embedding vectors are prepared and uploaded to a Cloud Storage bucket.21 Vertex AI Vector Search then consumes this data to build a high-performance index, often referred to as a corpus when using the Vertex AI RAG Engine.22 This index optimizes the knowledge base for searching, acting conceptually like a detailed table of contents for rapid information lookup.16 After the index is built, it is deployed to a managed Index Endpoint, which provides the low-latency API required for real-time retrieval during the runtime phase.21

The Dual Purpose of Metadata

Effective enterprise RAG solutions recognize that vector similarity search alone is often insufficient. Retrieval quality is significantly enhanced by leveraging metadata, which is structural and contextual information (e.g., document source, creation timestamp, section name) attached to each vector chunk.23
The significance of metadata is twofold. First, it enables pre-filtering during retrieval, allowing the system to restrict the vector search space based on structured criteria (e.g., "only search documents authored in the last year"). Second, metadata is absolutely critical for citation generation. The LLM relies on the source URI and title associated with the retrieved chunk to output verifiable, auditable claims, which is a core requirement for building trust and accuracy in the application.4 Firestore can be utilized as a companion document store to manage this structured metadata alongside the Vector Search index.23

3. Automating the Ingestion Pipeline (MLOps)

Stale data is a direct cause of factual decay and hallucinations in a RAG system. Therefore, the knowledge ingestion workflow must be operationalized as an automated MLOps pipeline.
Vertex AI Pipelines is the prescribed platform for defining and running this automation. It allows for the definition of complex, multi-stage ML workflows (e.g., document parsing, chunking, embedding generation, index creation/updating) using Kubeflow Pipelines or TFX.16 This setup ensures that when new documents are added or existing data is modified, the index is automatically refreshed, maintaining data freshness and relevance.
While Cloud Dataflow offers powerful capabilities for large-scale data transformation, particularly for real-time streaming data ingestion and generalized ETL 24, Vertex AI Pipelines offers a more cohesive and native platform for managing the ML artifacts inherent to the RAG workflow (e.g., the embedding models and the Vector Search index creation/updates). For the specific MLOps task of managing the RAG knowledge base lifecycle, Vertex AI Pipelines provides superior, integrated control.16 Furthermore, specific database solutions like AlloyDB are evolving to include features like automatic vector embeddings and incremental index updates, which can simplify the need for complex custom ETL for data residing within the database.26

IV. Phase II: The Life of a Prompt and Runtime Orchestration

The runtime orchestration layer is where the RAG chain is executed in real-time, handling user interaction, memory management, retrieval, and final generation. This logic primarily resides within the secure, scalable environment of Cloud Run.6

1. The Prompt Life Cycle Walkthrough (RAG Retrieval)

The life of a user query through the RAG system follows a highly structured, multi-stage process:
User Query Reception (Cloud Run): The request originates from the Firebase App Hosting frontend and is securely forwarded to the Cloud Run API endpoint, which acts as the application's entry point and security gateway.6
State and History Management: The Cloud Run service identifies the current conversation session and retrieves the existing conversation history from the Cloud Firestore memory store.28 Logic is applied here to manage the context window, such as summarizing older exchanges or truncating irrelevant history, ensuring the token budget is not exceeded.13
Query Vectorization: The latest user query (potentially augmented by conversation history context) is sent to the Vertex AI Text Embedding API to generate a high-dimensional vector representation using the exact same model utilized during ingestion.6
Retrieval (Vector Search): The query vector is passed to the Vertex AI Vector Search Index Endpoint. The index performs an efficient vector similarity search, identifying the top $K$ most semantically relevant document chunks and retrieving their associated metadata (source URI, title, etc.).6
Post-Retrieval Optimization: Before context injection, the Cloud Run orchestrator applies quality control measures to the retrieved chunks. This critical step includes Deduplication, identifying and removing highly overlapping or redundant content to minimize prompt length and token cost.8 It also includes Re-ranking, where a secondary model or heuristic logic prioritizes the most relevant and novel chunks from the initial $K$ results.8
Context Augmentation: The finalized set of retrieved context, the managed conversation history, and a detailed instruction set (System Prompt/Instructions) are meticulously concatenated to form the final, augmented prompt.22
Generation: The augmented prompt is submitted to the Gemini model deployed on Vertex AI. To ensure optimal UX and responsiveness, the API call must utilize the streaming method (e.g., generateContentStream).10
Output Processing and Delivery: The streamed response, along with the explicit groundingMetadata (which contains the citation sources used by the model) 4, is immediately relayed through the Cloud Run backend back to the client, managed efficiently by the Firebase App Hosting layer.29

2. Managing Multi-Turn Conversation State (Memory)

A production chat application requires persistent memory across turns. A pure RAG architecture must be augmented with a robust memory solution to prevent context window exhaustion and maintain conversational coherence.30

Persistence Layer: Cloud Firestore

Cloud Firestore is the recommended serverless, NoSQL database for persistent memory management within the Firebase/GCP ecosystem. It integrates natively, offering simplified persistence and scalability for message history. Furthermore, Firestore supports LangChain’s chat message history components, simplifying development if an orchestration framework is utilized.28

Active Context Window Management

The challenge in multi-turn RAG conversations is that user input, agent response, and the retrieved documents all accumulate, rapidly consuming the LLM's finite context window.13 Effective management is required:
Context Management Strategies: Simple Sliding Windows (limiting history to the last $N$ interactions) are fast but risk losing long-term conversational context.8 The expert approach is the Hybrid (Long-Short-Term Memory) model, which involves summarizing older parts of the conversation (long-term memory) and including only the raw text of the most recent turns (short-term memory).8 This method intelligently balances depth of context retention with token efficiency.
The Traceability Imperative: The memory schema must support traceability, which requires capturing the full state of the RAG execution. Specifically, the data model must store not just the text history but also the specific grounding chunks retrieved and utilized for each turn. This supports later auditing, debugging, and continuous evaluation of the RAG system.23
Table: Firestore Data Schema for RAG Chat State

V. Full-Stack Implementation on Google Cloud and Firebase

The end-to-end RAG architecture is realized by combining the power of Vertex AI's managed components with the developer-friendly deployment and hosting services offered by Firebase.

1. The Developer-Facing API Backend (Cloud Run)

Cloud Run is designated as the ideal serverless compute platform for deploying the RAG orchestration logic.6
Platform Justification: Cloud Run provides a flexible execution environment capable of hosting containerized applications (e.g., Python services utilizing Vertex AI SDKs).6 It offers native auto-scaling capabilities, making it highly elastic. Unlike simpler options like Cloud Functions, Cloud Run is better suited for complex, multi-step orchestration workflows and for managing persistent, streaming HTTP connections, which is critical for the chat UX.29
Streaming Implementation: The backend application must be engineered to handle the asynchronous nature of streaming. It initiates a request to the Vertex AI Gemini endpoint and, upon receiving the streamed response fragments, immediately buffers and transmits these fragments back to the client, effectively reducing the appearance of latency for the end-user.10
Security Gateway: Crucially, Cloud Run serves as the essential security perimeter. It utilizes a secure IAM service account to access Vertex AI resources, preventing the direct exposure of credentials or the Vertex AI endpoints themselves to the public internet or the client-side application.6

2. The User Interface and Deployment (Firebase App Hosting)

Firebase App Hosting provides the necessary infrastructure to deploy and manage dynamic, full-stack web applications, such as those built with Next.js, that interact seamlessly with the Cloud Run backend and Vertex AI services.9
Streamlined CI/CD and Infrastructure: App Hosting integrates directly with GitHub for automated continuous deployment (CI/CD), building applications with Cloud Build, serving them on Cloud Run, and caching content via Cloud CDN.9 This simplifies the operational burden associated with modern web application deployment.
Enhanced UX and Streaming Support: App Hosting is explicitly designed to leverage streaming support, which is mandatory for maintaining fast initial load times and delivering real-time responses from generative AI features.9
Firebase Ecosystem Integration: The platform integrates tightly with other Firebase services, including the Firebase AI Logic client SDKs, which simplify the client-side integration with the secured Gemini API via the Cloud Run proxy.34 Furthermore, Firebase Remote Config offers a powerful mechanism for application engineers to dynamically adjust prompts, model versions, or retrieval parameters in the backend without requiring users to download a full application update.34
Table: Runtime Component Responsibilities


VI. Operationalizing and Securing the Solution

Achieving production readiness involves establishing rigorous security protocols, ensuring scalability, and managing operational costs.

1. Security and Access Control (IAM)

Security is paramount, particularly when handling proprietary enterprise data used for grounding.
Principle of Least Privilege: Every component must operate with the minimum required permissions. The Cloud Run service instance must utilize a dedicated IAM Service Account. This service account requires, at a minimum, the Vertex AI User role (roles/aiplatform.user) to perform prediction calls to the Gemini model, access the embedding models, and query the Vector Search Index Endpoint.11 If the service modifies history, additional roles for Firestore access are needed.
Ingestion Pipeline Security: The service account running the Vertex AI Pipelines orchestration must have permissions to read data from the source storage (e.g., Cloud Storage) and perform resource operations (write and update) on the Vector Search Index.
Data Isolation and Compliance: For environments requiring high regulatory compliance and data security, advanced controls such as VPC-SC (Virtual Private Cloud Service Controls) are supported by the core Vertex AI RAG Engine components, ensuring that sensitive data operations remain within the defined secure network perimeter.36

2. Scaling, Observability, and Performance

Scaling the RAG infrastructure requires careful resource provisioning and continuous monitoring.
Vector Search Scaling: Vertex AI Vector Search endpoints must be sized appropriately based on anticipated QPS (Queries Per Second) and acceptable latency thresholds.7 Deployments should be planned to allow for incremental index updates when possible, rather than full index rebuilds, to maintain high availability and freshness.
Observability and Evaluation: Operational stability requires centralized logging (Cloud Logging) and tracing capabilities across the entire chain. Crucially, the system must be capable of tracing the execution to monitor retrieval quality.13 Integrating with Vertex AI Evaluation allows for continuous quality assessment, measuring aspects like citation accuracy and relevance of retrieved chunks, which provides the necessary feedback loop for refining chunking strategies and retrieval parameters.12 Monitoring helps maintain system health and ensures that the retrieval mechanism surfaces the correct information for agent operations.13

3. Cost Management Strategies

RAG systems introduce complex cost drivers across ingestion, compute, and inference. Proactive cost management is essential for long-term production viability.
Table: Production Cost Optimization Vectors


VII. Conclusion and Recommendations

The transition from an ungrounded Gemini chat implementation to a production RAG system necessitates a comprehensive, componentized architecture leveraging the strengths of the Google Cloud ecosystem. The recommended blueprint establishes a highly scalable and secure solution by coupling the developer-facing features of Firebase App Hosting with the enterprise AI capabilities of Vertex AI.
For rapid deployment and streamlined management, leveraging the Vertex AI RAG Engine with Vertex AI Search as the grounding corpus provides a robust, low-maintenance solution that handles complex infrastructure automatically. For scenarios demanding maximum control over specific retrieval nuances (e.g., proprietary chunking or custom re-ranking), the DIY approach is recommended, utilizing Cloud Run as the primary orchestrator, coordinating requests across the Vertex AI Text Embedding API and Vertex AI Vector Search.
Regardless of the chosen approach, success depends heavily on two critical operational considerations:
Ingestion Fidelity: Prioritizing sophisticated document-based and recursive chunking strategies over simple fixed-size methods is essential to ensure high retrieval quality and precise grounding context.
Runtime State Management: The implementation must integrate Cloud Firestore to robustly manage multi-turn conversation history, employing a hybrid memory management strategy (summarization for long-term context, raw text for short-term context) to prevent context window saturation while maintaining conversational coherence.
By adhering to this architectural roadmap, utilizing serverless components, implementing strict IAM controls, and focusing on streaming latency optimization, the organization can successfully deploy an accurate, scalable, and fully observable RAG-powered conversational AI solution.
Works cited
Vertex AI RAG Engine: A developers tool, accessed November 30, 2025, https://developers.googleblog.com/en/vertex-ai-rag-engine-a-developers-tool/
What is Retrieval-Augmented Generation (RAG)? - Google Cloud, accessed November 30, 2025, https://cloud.google.com/use-cases/retrieval-augmented-generation
What is Retrieval Augmented Generation (RAG)? - Databricks, accessed November 30, 2025, https://www.databricks.com/glossary/retrieval-augmented-generation-rag
Grounding with Google Search | Gemini API, accessed November 30, 2025, https://ai.google.dev/gemini-api/docs/google-search
Grounding overview | Generative AI on Vertex AI - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview
RAG infrastructure for generative AI using Vertex AI and Vector Search | Cloud Architecture Center, accessed November 30, 2025, https://docs.cloud.google.com/architecture/gen-ai-rag-vertex-ai-vector-search
Vertex AI Platform | Google Cloud, accessed November 30, 2025, https://cloud.google.com/vertex-ai
Repeated Conversational Memory in RAG-based Chatbot - Google Help, accessed November 30, 2025, https://support.google.com/gemini/thread/376054018/repeated-conversational-memory-in-rag-based-chatbot?hl=en-gb
Firebase App Hosting, accessed November 30, 2025, https://firebase.google.com/docs/app-hosting
Stream answers | Vertex AI Search | Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/generative-ai-app-builder/docs/stream-answer
Gemini API in Vertex AI quickstart - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart
How to Build a Production-Grade RAG with ADK & Vertex AI RAG Engine via the Agent Starter Pack | Google Cloud - Medium, accessed November 30, 2025, https://medium.com/google-cloud/how-to-build-a-production-grade-rag-with-adk-vertex-ai-rag-engine-via-the-agent-starter-pack-7e39e9cfe856
Context Window Management: Strategies for Long-Context AI Agents and Chatbots, accessed November 30, 2025, https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/
RAG On GCP: Production-ready GenAI On Google Cloud Platform - Xebia, accessed November 30, 2025, https://xebia.com/blog/rag-on-gcp/
Vertex AI RAG Engine: Build & deploy RAG implementations with your data - Google Cloud, accessed November 30, 2025, https://cloud.google.com/blog/products/ai-machine-learning/introducing-vertex-ai-rag-engine
Vector Search | Vertex AI | Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/vertex-ai/docs/vector-search/overview
Understanding Embeddings for Generative AI - Unstructured, accessed November 30, 2025, https://unstructured.io/insights/understanding-embeddings-for-generative-ai
Fine-tune RAG transformations | Generative AI on Vertex AI - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/fine-tune-rag-transformations
Chunking Strategies to Improve Your RAG Performance | Weaviate, accessed November 30, 2025, https://weaviate.io/blog/chunking-strategies-for-rag
Parse and chunk documents | Vertex AI Search - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/generative-ai-app-builder/docs/parse-chunk-documents
Vector Search quickstart | Vertex AI - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/vertex-ai/docs/vector-search/quickstart
Vertex AI RAG Engine overview - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-overview
LlamaIndex for RAG on Google Cloud, accessed November 30, 2025, https://cloud.google.com/blog/products/ai-machine-learning/llamaindex-for-rag-on-google-cloud
Dataflow ML - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/dataflow/docs/machine-learning
Streaming prediction with dataflow and vertex | Google Cloud Blog, accessed November 30, 2025, https://cloud.google.com/blog/products/ai-machine-learning/streaming-prediction-with-dataflow-and-vertex
AlloyDB AI auto vector embeddings and auto vector index | Google Cloud Blog, accessed November 30, 2025, https://cloud.google.com/blog/products/databases/alloydb-ai-auto-vector-embeddings-and-auto-vector-index
Building RAG with Vertex AI RAG Engine | by Adityo Pratomo - Medium, accessed November 30, 2025, https://adityop.medium.com/building-rag-with-vertex-ai-rag-engine-e04bf9ebfa08
Build LLM-powered applications using LangChain | Firestore in Native mode, accessed November 30, 2025, https://docs.cloud.google.com/firestore/native/docs/langchain
Gemini Live API: Real-time AI for Manufacturing | Google Cloud Blog, accessed November 30, 2025, https://cloud.google.com/blog/topics/developers-practitioners/gemini-live-api-real-time-ai-for-manufacturing
[2501.03468] MTRAG: A Multi-Turn Conversational Benchmark for Evaluating Retrieval-Augmented Generation Systems - arXiv, accessed November 30, 2025, https://arxiv.org/abs/2501.03468
6 Techniques You Should Know to Manage Context Lengths in LLM Apps - Reddit, accessed November 30, 2025, https://www.reddit.com/r/LLMDevs/comments/1mviv2a/6_techniques_you_should_know_to_manage_context/
Evaluating Multi-Turn Conversations (Simulation) - Langfuse, accessed November 30, 2025, https://langfuse.com/guides/cookbook/example_simulated_multi_turn_conversations
Compare Cloud Run functions - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/run/docs/functions/comparison
Firebase AI Logic client SDKs | Build generative AI features directly into your mobile and web apps, accessed November 30, 2025, https://firebase.google.com/products/firebase-ai-logic
Use server-side Remote Config with Cloud Functions and Vertex AI - Firebase - Google, accessed November 30, 2025, https://firebase.google.com/docs/remote-config/solution-server
RAG quickstart | Generative AI on Vertex AI - Google Cloud Documentation, accessed November 30, 2025, https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-quickstart
Build a RAG System Using Vertex AI Embeddings | by Tejas Pravinbhai Patel - Medium, accessed November 30, 2025, https://medium.com/@tejas.patel_41715/build-a-rag-system-using-vertex-ai-embeddings-cf6bb2dfba9f
Vertex AI Pricing | Google Cloud, accessed November 30, 2025, https://cloud.google.com/vertex-ai/generative-ai/pricing
