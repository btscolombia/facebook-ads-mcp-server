# Facebook/Meta Ads MCP Server

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/gomarble-ai/facebook-ads-mcp-server)](https://archestra.ai/mcp-catalog/gomarble-ai__facebook-ads-mcp-server)
[![smithery badge](https://smithery.ai/badge/@gomarble-ai/facebook-ads-mcp-server)](https://smithery.ai/server/@gomarble-ai/facebook-ads-mcp-server)

This project provides an MCP server acting as an interface to the Meta Ads, enabling programmatic access to Meta Ads data and management features.

<video controls width="1920" height="512" src="https://github.com/user-attachments/assets/c4a76dcf-cf5d-4a1d-b976-08165e880fe4">Your browser does not support the video tag.</video>

## Easy One-Click Setup

For a simpler setup experience, we offer ready-to-use installers:

👉 **Download installer -** [https://gomarble.ai/mcp](https://gomarble.ai/mcp)

## Join our community for help and updates

👉 **Slack Community -** [AI in Ads](https://join.slack.com/t/ai-in-ads/shared_invite/zt-36hntbyf8-FSFixmwLb9mtEzVZhsToJQ)

## Try Google ads mcp server also

👉 **Google Ads MCP -** [Google Ads MCP](https://github.com/gomarble-ai/google-ads-mcp-server)

### What It Does

- Installs and configures the MCP server locally
- Automatically handles environment setup
- Prompts for Meta token authentication during the process which is optional
- If Meta access token is not provided then connect to GoMarble's server to create the token on your behalf

### Important Disclaimer

This setup **does not require** you to manually obtain a Meta Developer Access Token.

Instead, it connects securely to **GoMarble's server to create the token on your behalf**.
GoMarble **does not store** your token — it is saved locally on your machine for use with the MCP server.

---

## Setup

### Prerequisites

*   Python 3.10+
*   Dependencies listed in `requirements.txt`



1.  **(Optional but Recommended) Create and Activate a Virtual Environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

    Using a virtual environment helps manage project dependencies cleanly[[Source]](https://docs.python.org/3/tutorial/venv.html).
2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Obtain Meta Access Token:** Secure a Meta User Access Token with the necessary permissions (e.g., `ads_read`). You can generate this through the Meta Developer portal. Follow [this link](https://elfsight.com/blog/how-to-get-facebook-access-token/).

### Usage with MCP Clients (e.g., Cursor, Claude Desktop)

To integrate this server with an MCP-compatible client, add a configuration([Claude](https://modelcontextprotocol.io/quickstart/user#2-add-the-filesystem-mcp-server)) similar to the following. Replace `YOUR_META_ACCESS_TOKEN` with your actual token and adjust the path to `server.py` if necessary.

```json
{
  "mcpServers": {
    "fb-ads-mcp-server": {
      "command": "python",
      "args": [
        "/path/to/your/fb-ads-mcp-server/server.py",
        "--fb-token",
        "YOUR_META_ACCESS_TOKEN"
      ]
      // If using a virtual environment, you might need to specify the python executable within the venv:
      // "command": "/path/to/your/fb-ads-mcp-server/venv/bin/python",
      // "args": [
      //   "/path/to/your/fb-ads-mcp-server/server.py",
      //   "--fb-token",
      //   "YOUR_META_ACCESS_TOKEN"
      // ]
    }
  }
}
```
Restart the MCP Client app after making the update in the configuration.

*(Note: On Windows, you might need to adjust the command structure or use `cmd /k` depending on your setup.)*

### Debugging the Server

Execute `server.py`, providing the access token via the `--fb-token` argument.

```bash
python server.py --fb-token YOUR_META_ACCESS_TOKEN
```

### Remote HTTP Deployment (Dockploy, Cursor, Antigravity)

For remote deployment (Docker/Dockploy), the server supports **Streamable HTTP** transport so Cursor and Antigravity can connect via URL.

**Environment variables for Docker:**
| Variable | Required | Description |
|----------|----------|-------------|
| `TRANSPORT` | Yes | Set to `http` to enable HTTP mode |
| `FB_TOKEN` | Yes | Meta/Facebook access token |
| `PORT` | No | Port to listen on (default: 8000) |
| `HOST` | No | Host to bind (default: 0.0.0.0) |
| `ALLOWED_HOSTS` | No | Comma-separated list of allowed Host headers (e.g. `metamcp.example.com`). If empty with TRANSPORT=http, Host validation is disabled for proxy deployments. |
| | | *Con TRANSPORT=http: stateless + json_response (respuestas JSON directas, sin envoltura SSE) para n8n, Antigravity y clientes HTTP.* |

**Example Dockploy env:**
```
TRANSPORT=http
FB_TOKEN=your_meta_access_token
PORT=8000
```

The MCP endpoint will be available at `https://your-domain.com/mcp`

**Cursor Configuration** (Settings → Tools & MCP → Add new MCP server):
- **Type:** `streamableHttp`
- **URL:** `https://metamcp.agencybts.com/mcp` (use your domain)
- **Headers:** (optional) Add `Authorization` if you add auth later

**Antigravity Configuration:**
1. Abre Antigravity → menú "..." del panel del agente → **MCP Servers** → **Manage MCP Servers**
2. Haz clic en **View raw config** para editar `mcp_config.json`
3. Ubicación del archivo: `~/.gemini/antigravity/mcp_config.json` (macOS/Linux) o `C:\Users\<USER>\\.gemini\antigravity\mcp_config.json` (Windows)
4. Añade o edita la entrada (Antigravity usa `serverUrl` para servidores HTTP):

```json
{
  "mcpServers": {
    "meta-ads": {
      "serverUrl": "https://metamcp.agencybts.com/mcp"
    }
  }
}
```

5. Reinicia Antigravity para que cargue la configuración

**Varios clientes (una cuenta por carpeta):** El MCP remoto usa un solo token y lista todas las cuentas. Para que el agente use la cuenta correcta en cada cliente, crea `META_ADS_CONTEXT.md` en la raíz de cada carpeta de cliente con el act_id y page_id. Ver [docs/ANTIGRAVITY-CLIENTES.md](docs/ANTIGRAVITY-CLIENTES.md).

### Available MCP Tools

This MCP server provides tools for interacting with META Ads objects and data:

| Tool Name                       | Description                                              |
| ------------------------------- | -------------------------------------------------------- |
| **Account & Object Read**       |                                                          |
| `list_ad_accounts`              | Lists ad accounts linked to the token.                   |
| `get_details_of_ad_account`     | Retrieves details for a specific ad account.             |
| `get_campaign_by_id`            | Retrieves details for a specific campaign.               |
| `get_adset_by_id`               | Retrieves details for a specific ad set.                 |
| `get_ad_by_id`                  | Retrieves details for a specific ad.                     |
| `get_ad_creative_by_id`         | Retrieves details for a specific ad creative.            |
| `get_adsets_by_ids`             | Retrieves details for multiple ad sets by their IDs.     |
| **Fetching Collections**        |                                                          |
| `get_campaigns_by_adaccount`    | Retrieves campaigns within an ad account.                |
| `get_adsets_by_adaccount`       | Retrieves ad sets within an ad account.                  |
| `get_ads_by_adaccount`          | Retrieves ads within an ad account.                      |
| `get_adsets_by_campaign`        | Retrieves ad sets within a campaign.                     |
| `get_ads_by_campaign`           | Retrieves ads within a campaign.                         |
| `get_ads_by_adset`              | Retrieves ads within an ad set.                          |
| `get_ad_creatives_by_ad_id`     | Retrieves creatives associated with an ad.               |
| **Insights & Performance Data** |                                                          |
| `get_adaccount_insights`        | Retrieves performance insights for an ad account.        |
| `get_campaign_insights`         | Retrieves performance insights for a campaign.           |
| `get_adset_insights`            | Retrieves performance insights for an ad set.            |
| `get_ad_insights`               | Retrieves performance insights for an ad.                |
| `fetch_pagination_url`          | Fetches data from a pagination URL (e.g., from insights).|
| **Activity/Change History**     |                                                          |
| `get_activities_by_adaccount`   | Retrieves change history for an ad account.              |
| `get_activities_by_adset`       | Retrieves change history for an ad set.                  |
| **Dynamic Creative (5 textos + 5 títulos)** |                                                |
| `update_ad_creative_assets`     | Updates primary text (bodies) and titles of an ad creative. Use for Dynamic Creative A/B testing (5 texts + 5 titles). |
| `create_lead_gen_test_campaign` | Creates a Lead Gen campaign with Dynamic Creative (5 cuerpos + 5 títulos) using an existing form. |
| `get_leadgen_forms`             | Lists Lead Gen forms for a Facebook Page (used by create_lead_gen_test_campaign). |

*(Note: Most tools support additional parameters like `fields`, `filtering`, `limit`, pagination, date ranges, etc. Refer to the detailed docstrings within `server.py` for the full list and description of arguments for each tool.)*

*(Note: If your Meta access token expires, you'll need to generate a new one and update the configuration file of the MCP Client with new token to continue using the tools.)*

### Dependencies

*   [mcp](https://pypi.org/project/mcp/) (>=1.6.0)
*   [requests](https://pypi.org/project/requests/) (>=2.32.3)

### License
This project is licensed under the MIT License.

---

## Installing via Smithery

To install Facebook Ads Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@gomarble-ai/facebook-ads-mcp-server):

```bash
npx -y @smithery/cli install @gomarble-ai/facebook-ads-mcp-server --client claude
```
