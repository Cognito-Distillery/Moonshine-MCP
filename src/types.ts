export type MashType = '결정' | '문제' | '인사이트' | '질문';

export type MashStatus =
  | 'MASH_TUN'
  | 'ON_STILL'
  | 'DISTILLED'
  | 'JARRED'
  | 'RE_EMBED'
  | 'RE_EXTRACT';

export type RelationType = 'RELATED_TO' | 'SUPPORTS' | 'CONFLICTS_WITH';

export type EdgeSource = 'ai' | 'human';

export interface Mash {
  id: string;
  type: MashType;
  status: MashStatus;
  summary: string;
  context: string;
  memo: string;
  created_at: number;
  updated_at: number;
}

export interface Edge {
  id: number;
  source_id: string;
  target_id: string;
  relation_type: RelationType;
  source: EdgeSource;
  confidence: number;
  created_at: number;
  updated_at: number;
}

export interface GraphNode {
  id: string;
  type: MashType;
  summary: string;
  context: string;
  memo: string;
  created_at: number;
  updated_at: number;
}

export interface GraphEdge {
  id: number;
  source_id: string;
  target_id: string;
  relation_type: RelationType;
  source: EdgeSource;
  confidence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SimilarResult {
  id: string;
  type: MashType;
  summary: string;
  context: string;
  memo: string;
  similarity: number;
}

export type EmbeddingProvider = 'openai' | 'gemini';
