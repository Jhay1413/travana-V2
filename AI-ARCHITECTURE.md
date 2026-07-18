# AI Chat Orchestrator Architecture
**Version:** 1.0  
**Backend:** Express.js  
**LLM:** OpenAI Responses API (Recommended)  
**Architecture Pattern:** Orchestrator + Specialized Agents

---

# Overview

This architecture allows a user to interact with **one chat interface** while internally routing requests to different AI agents.

Example:

- Sales Agent
- Admin Agent

The user never chooses which agent to talk to. Instead, an **Orchestrator** determines the appropriate agent for every message.

---

# Goals

- Single conversation for the user.
- Clear separation of responsibilities.
- Minimize hallucinations.
- Easy to maintain.
- Easy to scale with more agents.
- Independent prompts for each domain.

---

# High-Level Architecture

```text
                     Client (Web/Mobile)
                             │
                             │ POST /api/chat
                             ▼
                    Express Chat Controller
                             │
                             ▼
                     Chat Orchestrator
                             │
          ┌──────────────────┴──────────────────┐
          │                                     │
          ▼                                     ▼
   Conversation Store                    Intent Router
          │                              (OpenAI)
          │                                     │
          │                                     ▼
          │                          ADMIN or SALES
          │                                     │
          └──────────────────┬──────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
        Admin Agent                  Sales Agent
              │                             │
              ▼                             ▼
      Business Services             Business Services
              │                             │
              └──────────────┬──────────────┘
                             ▼
                         Database
```

---

# Components

## 1. Chat Controller

Responsibilities

- Accept API requests.
- Validate payload.
- Call the orchestrator.
- Return the response.

The controller **must not contain AI logic**.

Example:

```
POST /api/chat
```

---

## 2. Chat Orchestrator

The orchestrator is the heart of the system.

Responsibilities

1. Load conversation history.
2. Determine the active agent.
3. Call the router.
4. Invoke the selected agent.
5. Save the updated conversation.
6. Return the response.

The orchestrator should be the **only place** responsible for deciding which agent is used.

---

## 3. Intent Router

The router does **not answer user questions**.

Its only responsibility is:

```
Determine which agent should handle this message.
```

Expected outputs:

```
ADMIN
```

or

```
SALES
```

Nothing else.

### Router Prompt

Example:

```
You are an intent router.

Available agents:

ADMIN
- inventory
- products
- suppliers
- employees
- reports
- dashboard
- settings

SALES
- pricing
- product recommendation
- promotions
- discounts
- customer inquiries
- checkout

Rules:

Return only one word.

ADMIN
or
SALES
```

This prompt should remain simple.

Avoid asking the router to answer questions.

---

# Why Keep the Router Small?

A smaller routing prompt provides:

- lower cost
- faster responses
- fewer hallucinations
- consistent routing

The router should never generate explanations.

---

# 4. Admin Agent

Responsibilities

- Inventory management
- Product creation
- Reports
- User management
- Suppliers
- Dashboard
- Analytics

Example system prompt:

```
You are the Admin Assistant.

You help administrators manage the business.

Never provide product recommendations.

Never act like a sales assistant.

If information is unavailable, state that clearly instead of guessing.
```

---

# 5. Sales Agent

Responsibilities

- Product recommendations
- Product information
- Pricing
- Promotions
- Upselling
- Customer support

Example system prompt

```
You are the Sales Assistant.

You help customers purchase products.

Never modify inventory.

Never create reports.

If you don't know an answer, say so rather than inventing details.
```

---

# Request Flow

```
User

    │

POST /api/chat

    │

Chat Controller

    │

Chat Orchestrator

    │

Load Conversation

    │

Call Router

    │

Router returns SALES

    │

Sales Agent

    │

OpenAI

    │

Assistant Response

    │

Save Conversation

    │

Return Response
```

---

# Conversation Switching

Example:

User:

```
Recommend a gaming laptop.
```

Router

```
SALES
```

---

Later

User:

```
Add a new laptop to inventory.
```

Router

```
ADMIN
```

The user remains in one conversation.

Only the internal agent changes.

---

# Conversation Storage

Each conversation should store:

```json
{
    "sessionId": "abc123",
    "messages": [
        {
            "role": "user",
            "content": "Recommend a laptop"
        },
        {
            "role": "assistant",
            "content": "Here are three recommendations..."
        }
    ],
    "currentAgent": "SALES"
}
```

---

# Folder Structure

```
src/

controllers/
    chat.controller.js

routes/
    chat.routes.js

services/

    orchestrator.js

    router.js

    agents/
        admin.agent.js
        sales.agent.js

prompts/
    router.prompt.js
    admin.prompt.js
    sales.prompt.js

repositories/
    conversation.repository.js

tools/
    inventory.tool.js
    report.tool.js
    product.tool.js

database/

app.js
```

---

# Orchestrator Sequence

```
receive message

↓

load conversation

↓

call router

↓

router returns agent

↓

invoke selected agent

↓

append assistant response

↓

save conversation

↓

return response
```

---

# Express Flow

```
Client

↓

POST /api/chat

↓

Chat Controller

↓

Chat Orchestrator

↓

Router

↓

Agent

↓

Database

↓

Response
```

---

# Recommended OpenAI Calls

## Router Call

Purpose:

Only determine intent.

Temperature:

```
0
```

Reason:

Deterministic routing.

---

## Agent Call

Purpose:

Generate the final response.

Temperature:

```
0.3 - 0.7
```

Choose the value based on how creative the responses should be.

---

# Hallucination Reduction Strategies

## 1. Separate Responsibilities

Do not allow Sales to answer admin questions.

Do not allow Admin to answer customer questions.

---

## 2. Keep Prompts Focused

Avoid huge prompts containing every business rule.

Each agent should only know its own domain.

---

## 3. Use Tools for Facts

Instead of embedding business data inside prompts:

Bad

```
The inventory contains ...
```

Good

```
The AI calls:

getInventory()

searchProducts()

getReports()

updateInventory()
```

The model should retrieve current data instead of relying on prompt memory.

---

## 4. Keep Conversation History Relevant

Instead of sending the entire chat history forever:

- Send recent messages.
- Include important summaries when needed.
- Exclude irrelevant context.

This reduces token usage and improves answer quality.

---

## 5. Use Low Temperature for Routing

The router should behave like a classifier, not a conversational assistant.

Recommended:

```
temperature = 0
```

---

## 6. Explicitly Permit "I Don't Know"

Every agent prompt should include guidance such as:

```
If the required information is unavailable or cannot be verified using the provided context or tools, clearly state that you do not know. Do not invent products, prices, inventory levels, reports, or business facts.
```

---

# Scalability

Adding another agent should require only:

1. New prompt
2. New agent module
3. Update router categories

Example:

```
Support Agent

Finance Agent

HR Agent

Marketing Agent
```

No changes to the frontend are required.

---

# Design Principles

- One public chat endpoint.
- One orchestrator responsible for routing.
- One router responsible only for classification.
- Specialized agents with isolated prompts.
- Business data retrieved through tools/services.
- Conversation persisted independently of the selected agent.
- Keep prompts focused and deterministic where possible.
- Prefer explicit tool calls over asking the model to remember business data.

---

# Summary

This architecture follows the **Orchestrator Pattern**, which is widely used for multi-agent AI systems. It separates **routing**, **conversation management**, and **domain-specific reasoning**, making the system easier to maintain, extend, and test. By keeping the router deterministic, using specialized prompts, and relying on backend services for business data, you significantly reduce hallucinations while preserving a seamless single-chat experience for users.