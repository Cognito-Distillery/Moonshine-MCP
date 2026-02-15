<p align="center">
  <img src="logo.png" width="96" alt="Moonshine" />
</p>

<h1 align="center">Moonshine MCP Server</h1>

<p align="center">
  <em>AI 어시스턴트가 당신의 지식 그래프에 접근할 수 있도록.</em>
</p>

<p align="center">
  <strong><a href="../README.md">English</a></strong>
</p>

---

[MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 서버로, Claude, ChatGPT, Gemini 등 AI 어시스턴트에서 [Moonshine](https://github.com/Cognito-Distillery/moonshine) 지식 그래프에 직접 접근할 수 있습니다.

SQLite 파일을 직접 읽기 때문에 **Moonshine 앱이 실행 중이지 않아도 동작합니다**.

---

## 사전 요구사항

- **[Node.js](https://nodejs.org/) v20+**
- **[Moonshine](https://github.com/Cognito-Distillery/moonshine)** 설치 및 매시 1개 이상 생성
- *(선택)* **OpenAI** 또는 **Google Gemini** API 키 — `search_semantic` 사용 시에만 필요

---

## 설치

```bash
git clone https://github.com/Cognito-Distillery/Moonshine-MCP.git
cd Moonshine-MCP
npm install
npm run build
```

---

## 설정

### Claude Desktop

Claude Desktop 설정 파일(`~/.config/Claude/claude_desktop_config.json`)에 추가:

```json
{
  "mcpServers": {
    "moonshine": {
      "command": "node",
      "args": ["/절대/경로/Moonshine-MCP/dist/index.js"]
    }
  }
}
```

### Claude Code

Claude Code 설정 파일(`~/.claude/settings.json`)에 추가:

```json
{
  "mcpServers": {
    "moonshine": {
      "command": "node",
      "args": ["/절대/경로/Moonshine-MCP/dist/index.js"]
    }
  }
}
```

### 기타 MCP 클라이언트

MCP 호환 클라이언트라면 **stdio 전송**으로 연결:

```bash
node /절대/경로/Moonshine-MCP/dist/index.js
```

---

## 데이터베이스 경로

서버가 Moonshine 데이터베이스를 자동으로 찾습니다:

| 플랫폼 | 기본 경로 |
|--------|----------|
| **Linux** | `~/.local/share/com.moonshine.app/moonshine.db` |
| **macOS** | `~/Library/Application Support/com.moonshine.app/moonshine.db` |
| **Windows** | `C:\Users\{user}\AppData\Roaming\com.moonshine.app\moonshine.db` |

다른 경로를 사용하려면 `MOONSHINE_DB_PATH` 환경변수를 설정하세요:

```json
{
  "mcpServers": {
    "moonshine": {
      "command": "node",
      "args": ["/절대/경로/Moonshine-MCP/dist/index.js"],
      "env": {
        "MOONSHINE_DB_PATH": "/커스텀/경로/moonshine.db"
      }
    }
  }
}
```

---

## 도구

### 매시 CRUD

| 도구 | 설명 |
|------|------|
| `list_mashes` | 상태/타입별 필터링으로 매시 목록 조회 |
| `get_mash` | ID로 단일 매시 조회 |
| `create_mash` | 새 매시 생성 (MASH_TUN 상태로 시작) |
| `update_mash` | 매시의 타입, 요약, 컨텍스트, 메모를 부분 수정 |
| `delete_mash` | 매시와 연결된 엣지를 함께 삭제 |

### 검색

| 도구 | 설명 |
|------|------|
| `search_keyword` | FTS5 trigram 키워드 전문 검색 (한국어 지원) |
| `search_semantic` | 임베딩 코사인 유사도 시맨틱 검색 (Moonshine 설정에 API 키 필요) |

### 지식 그래프

| 도구 | 설명 |
|------|------|
| `get_graph` | JARRED 매시의 전체 그래프 데이터 (타입/관계/소스별 필터링) |
| `get_node_detail` | 특정 노드 + 이웃 노드 + 연결 엣지 조회 |
| `add_edge` | 두 매시 간 관계 추가 (upsert) |
| `update_edge` | 엣지의 관계 타입 또는 신뢰도 수정 |
| `delete_edge` | 엣지 삭제 |

### 통계

| 도구 | 설명 |
|------|------|
| `get_stats` | 상태별/타입별 매시 수, 전체 엣지 수 조회 |

---

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MOONSHINE_DB_PATH` | 데이터베이스 파일 경로 오버라이드 | 플랫폼별 자동 감지 |
| `MOONSHINE_READ_ONLY` | `true`로 설정 시 모든 쓰기 작업 차단 | `false` |
| `MOONSHINE_DEBUG` | `true`로 설정 시 상세 stderr 로깅 | `false` |

---

## 동작 확인

[MCP Inspector](https://github.com/modelcontextprotocol/inspector)로 도구를 직접 테스트할 수 있습니다:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## 보안

- `password_hash`, `session_token`은 어떤 도구에서도 **절대 노출되지 않음**
- API 키는 내부적으로 settings 테이블에서 읽지만 **도구 응답에 포함하지 않음**
- `MOONSHINE_READ_ONLY=true`로 쓰기 완전 차단 가능
- WAL 모드로 Moonshine 앱과 동시 읽기 안전

---

## 라이선스

[MIT](LICENSE)

---

<p align="center"><sub>달빛 아래, 고요히.</sub></p>
