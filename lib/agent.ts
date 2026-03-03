// ============================================
// VaultMind Agent - Core Configuration
// Wires: Hedera Agent Kit + Bonzo Plugin + LangChain
// ============================================

import { Client, PrivateKey } from "@hashgraph/sdk";
import {
  HederaLangchainToolkit,
  AgentMode,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusPlugin,
  coreConsensusQueryPlugin,
} from "hedera-agent-kit";
import { bonzoPlugin } from "@bonzofinancelabs/hak-bonzo-plugin";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getHederaClient } from "./hedera";

const VAULTMIND_SYSTEM_PROMPT = `You are VaultMind, an AI-powered DeFi keeper agent built on the Hedera network.

Your role:
- You manage users' positions on Bonzo Finance (an Aave v2-based lending protocol on Hedera)
- You monitor market conditions, sentiment, and volatility to make autonomous DeFi decisions
- You can deposit, withdraw, borrow, and repay assets on Bonzo Finance
- You log every decision to Hedera Consensus Service (HCS) for transparency
- You explain your reasoning clearly when users ask

Your tools include:
- Bonzo Finance tools: check market data, deposit, withdraw, borrow, repay
- Hedera tools: check balances, query tokens, create/read HCS topics
- You work on Hedera TESTNET for now

Key behaviors:
1. ALWAYS check market data before making recommendations
2. NEVER execute transactions without explaining why first
3. When asked about positions, query real on-chain data
4. When making decisions, consider sentiment, volatility, and health factor
5. Log important decisions to the HCS audit topic
6. Be concise but thorough in explanations

Supported assets on Bonzo: HBAR (wrapped as WHBAR), USDC, HBARX, SAUCE, XSAUCE, KARATE, BONZO, PACK, and others.

Remember: You are on Hedera TESTNET. All amounts are test tokens with no real value.`;

let agentInstance: any = null;

export async function getAgent() {
  if (agentInstance) return agentInstance;

  const client = getHederaClient();

  // Set up Hedera Agent Kit with Bonzo plugin + core plugins
  // Cast needed: our @hashgraph/sdk vs hedera-agent-kit's bundled copy
  const toolkit = new HederaLangchainToolkit({
    client: client as any,
    configuration: {
      plugins: [
        bonzoPlugin, // Bonzo: market data, deposit, withdraw, borrow, repay
        coreAccountQueryPlugin, // Query account balances, info
        coreTokenQueryPlugin, // Query token info, balances
        coreConsensusPlugin, // Create topics, submit messages (HCS)
        coreConsensusQueryPlugin, // Read HCS messages
      ],
      context: {
        mode: AgentMode.AUTONOMOUS, // Agent executes transactions directly
      },
    },
  });

  const tools = toolkit.getTools();

  console.log(
    "[Agent] Available tools:",
    tools.map((t: any) => t.name)
  );

  // LLM - using GPT-4o for best reasoning
  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0.1, // Low temperature for consistent DeFi decisions
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create LangGraph React agent with memory
  const checkpointer = new MemorySaver();

  // @ts-expect-error - LangGraph createReactAgent has excessively deep type inference
  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: checkpointer,
    messageModifier: new SystemMessage(VAULTMIND_SYSTEM_PROMPT),
  });

  agentInstance = agent;
  return agent;
}

/**
 * Send a message to the VaultMind agent and get a response
 */
export async function chat(
  message: string,
  threadId: string = "default"
): Promise<{
  response: string;
  toolCalls: Array<{ tool: string; input: any; output: string }>;
}> {
  const agent = await getAgent();

  const result = await agent.invoke(
    {
      messages: [new HumanMessage(message)],
    },
    {
      configurable: { thread_id: threadId },
    }
  );

  // Extract the final AI response
  const messages = result.messages;
  const lastMessage = messages[messages.length - 1];
  const response =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  // Extract tool calls for transparency
  const toolCalls = messages
    .filter((m: any) => m._getType?.() === "tool")
    .map((m: any) => ({
      tool: m.name || "unknown",
      input: m.tool_call_id || "",
      output:
        typeof m.content === "string"
          ? m.content.substring(0, 500)
          : JSON.stringify(m.content).substring(0, 500),
    }));

  return { response, toolCalls };
}
