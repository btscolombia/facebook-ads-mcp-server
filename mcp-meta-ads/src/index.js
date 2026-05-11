import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import FormData from "form-data";
import { readFileSync } from "fs";
import { basename } from "path";
import { lookup } from "mime-types";
import dotenv from "dotenv";

// Load .env from parent directory
dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const PAGE_ID = process.env.META_PAGE_ID;
const API_VERSION = process.env.META_API_VERSION || "v25.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// ─── Helper: Meta API Request ───────────────────────────────────────────────
async function metaApi(endpoint, method = "GET", body = null) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (method === "GET") {
    url.searchParams.append("access_token", ACCESS_TOKEN);
  }

  const options = { method, headers: {} };

  if (body instanceof FormData) {
    body.append("access_token", ACCESS_TOKEN);
    options.body = body;
    Object.assign(options.headers, body.getHeaders());
  } else if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify({ ...body, access_token: ACCESS_TOKEN });
  }

  const res = await fetch(url.toString(), options);
  const json = await res.json();

  if (json.error) {
    throw new Error(
      `Meta API Error (${json.error.code}): ${json.error.message}`
    );
  }
  return json;
}

// ─── Tool Definitions ───────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_campaigns",
    description:
      "Lista las campañas existentes en la cuenta publicitaria de Meta Ads. Devuelve ID, nombre, estado y objetivo de cada campaña.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de campañas a listar (default: 10)",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "PAUSED", "ARCHIVED", "ALL"],
          description:
            "Filtrar por estado de la campaña (default: ALL)",
        },
      },
    },
  },
  {
    name: "create_campaign",
    description:
      "Crea una nueva campaña en Meta Ads. Soporta Advantage+ y campañas manuales. Devuelve el ID de la campaña creada.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre de la campaña" },
        objective: {
          type: "string",
          enum: [
            "OUTCOME_AWARENESS",
            "OUTCOME_ENGAGEMENT",
            "OUTCOME_LEADS",
            "OUTCOME_SALES",
            "OUTCOME_TRAFFIC",
            "OUTCOME_APP_PROMOTION",
          ],
          description:
            "Objetivo de la campaña. Para lead gen usa OUTCOME_LEADS.",
        },
        special_ad_categories: {
          type: "array",
          items: { type: "string" },
          description:
            "Categorías especiales: HOUSING, CREDIT, EMPLOYMENT, o array vacío []",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "PAUSED"],
          description: "Estado inicial (default: PAUSED para revisar antes de publicar)",
        },
        buying_type: {
          type: "string",
          enum: ["AUCTION", "RESERVED"],
          description: "Tipo de compra (default: AUCTION)",
        },
      },
      required: ["name", "objective"],
    },
  },
  {
    name: "create_adset",
    description:
      "Crea un conjunto de anuncios (Ad Set) dentro de una campaña. Configura presupuesto, segmentación, ubicaciones y programación.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del ad set" },
        campaign_id: {
          type: "string",
          description: "ID de la campaña donde se crea el ad set",
        },
        daily_budget: {
          type: "number",
          description:
            "Presupuesto diario en centavos de la moneda local (ej: 5000 = $50.00 COP? No, Meta usa la unidad mínima. Para COP, 50000 = 50,000 COP)",
        },
        billing_event: {
          type: "string",
          enum: ["IMPRESSIONS", "LINK_CLICKS"],
          description: "Evento de facturación (default: IMPRESSIONS)",
        },
        optimization_goal: {
          type: "string",
          enum: [
            "LEAD_GENERATION",
            "LINK_CLICKS",
            "IMPRESSIONS",
            "REACH",
            "LANDING_PAGE_VIEWS",
            "CONVERSATIONS",
            "QUALITY_LEAD",
          ],
          description:
            "Objetivo de optimización del ad set",
        },
        targeting: {
          type: "object",
          description:
            'Objeto de targeting de Meta. Para Advantage+ broad, usa: {"geo_locations": {"countries": ["CO"]}}. Ejemplo con ciudades: {"geo_locations": {"cities": [{"key": "CITY_KEY"}]}}',
        },
        start_time: {
          type: "string",
          description:
            "Fecha de inicio en formato ISO 8601 (ej: 2026-02-24T00:00:00-0500). Si no se especifica, inicia inmediatamente.",
        },
        end_time: {
          type: "string",
          description: "Fecha de fin en formato ISO 8601 (opcional)",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "PAUSED"],
          description: "Estado inicial (default: PAUSED)",
        },
      },
      required: ["name", "campaign_id", "daily_budget", "optimization_goal", "targeting"],
    },
  },
  {
    name: "upload_image",
    description:
      "Sube una imagen a la cuenta publicitaria de Meta Ads para usarla como creativo de anuncio. Devuelve el hash de la imagen para usarlo al crear anuncios.",
    inputSchema: {
      type: "object",
      properties: {
        image_path: {
          type: "string",
          description:
            "Ruta absoluta del archivo de imagen (PNG, JPG). Ejemplo: /Volumes/LuisD/Clientes BTS/Altiore Group/IMAGENES/IMAGEN 01.png",
        },
      },
      required: ["image_path"],
    },
  },
  {
    name: "upload_video",
    description:
      "Sube un video a la cuenta publicitaria de Meta Ads. El video se procesa de forma asíncrona. Devuelve el ID del video.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: {
          type: "string",
          description:
            "Ruta absoluta del archivo de video (MP4). Ejemplo: /Volumes/LuisD/Clientes BTS/Altiore Group/REEL 001.mp4",
        },
        title: {
          type: "string",
          description: "Título del video (opcional)",
        },
      },
      required: ["video_path"],
    },
  },
  {
    name: "create_ad_creative",
    description:
      "Crea un creativo de anuncio. REGLA CRÍTICA: Si call_to_action es WHATSAPP_MESSAGE o la campaña es de conversaciones de WhatsApp, SIEMPRE usa un solo texto (primary_texts[0]) y un solo título (headlines[0]). NO uses Dynamic Creative (múltiples textos/títulos) en campañas de WhatsApp — la API de Meta lo rechaza. Solo usa múltiples textos/títulos para campañas de TRÁFICO, RECONOCIMIENTO o LEADS que NO tengan CTA de WhatsApp.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre interno del creativo" },
        image_hash: {
          type: "string",
          description: "Hash de la imagen (obtenido de upload_image). Opcional si se usa video_id o no_media.",
        },
        video_id: {
          type: "string",
          description: "ID del video (obtenido de upload_video). Opcional si se usa image_hash o no_media.",
        },
        no_media: {
          type: "boolean",
          description: "Si es true, crea el creativo sin media (útil para carruseles que se completan manualmente en Business Manager).",
        },
        primary_texts: {
          type: "array",
          items: { type: "string" },
          description: "WHATSAPP: pasar solo 1 texto. OTRAS CAMPAÑAS: hasta 5 textos para Dynamic Creative. La API de Meta rechaza múltiples textos en campañas de WhatsApp.",
        },
        headlines: {
          type: "array",
          items: { type: "string" },
          description: "WHATSAPP: pasar solo 1 título. OTRAS CAMPAÑAS: hasta 5 títulos para Dynamic Creative.",
        },
        description: {
          type: "string",
          description: "Descripción corta (aparece debajo del título, opcional)",
        },
        link: {
          type: "string",
          description: "URL de destino del anuncio (usa https://wa.me/57XXXXXXXXXX para WhatsApp)",
        },
        call_to_action: {
          type: "string",
          enum: [
            "LEARN_MORE",
            "SIGN_UP",
            "GET_QUOTE",
            "CONTACT_US",
            "SEND_MESSAGE",
            "WHATSAPP_MESSAGE",
            "APPLY_NOW",
            "BOOK_TRAVEL",
            "SHOP_NOW",
            "DOWNLOAD",
          ],
          description: "CTA del anuncio. Usa WHATSAPP_MESSAGE para campañas de WhatsApp (fuerza creativo estático, sin DCO).",
        },
        whatsapp_phone_number: {
          type: "string",
          description: "Número de WhatsApp (ej: +573216583861). Requerido si call_to_action es WHATSAPP_MESSAGE.",
        },
      },
      required: ["name", "primary_texts", "headlines", "link"],
    },
  },
  {
    name: "create_carousel_creative",
    description:
      "Crea un creativo de anuncio en formato SECUENCIA (Carrusel/Carousel) con múltiples tarjetas de imagen. Usa child_attachments para cada tarjeta. NOTA: Para campañas de WhatsApp omite el campo 'value' del CTA — solo especifica el type: WHATSAPP_MESSAGE. Devuelve el ID del creativo.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre interno del creativo" },
        message: {
          type: "string",
          description: "Texto principal del anuncio (aparece arriba de todas las tarjetas)",
        },
        cards: {
          type: "array",
          description: "Array de tarjetas del carrusel. Mínimo 2, máximo 10.",
          items: {
            type: "object",
            properties: {
              image_hash: { type: "string", description: "Hash de la imagen de esta tarjeta" },
              title: { type: "string", description: "Título de la tarjeta (aparece debajo de la imagen)" },
              description: { type: "string", description: "Descripción corta de la tarjeta" },
              link: { type: "string", description: "URL de destino de la tarjeta (wa.me para WhatsApp)" },
            },
            required: ["image_hash", "title", "link"],
          },
        },
        call_to_action: {
          type: "string",
          description: "CTA para todas las tarjetas. Para WhatsApp usa WHATSAPP_MESSAGE.",
          enum: ["LEARN_MORE", "CONTACT_US", "SEND_MESSAGE", "WHATSAPP_MESSAGE", "SHOP_NOW", "GET_QUOTE"],
        },
      },
      required: ["name", "message", "cards"],
    },
  },
  {
    name: "create_ad",
    description:
      "Crea un anuncio (Ad) dentro de un Ad Set, asociándolo con un creativo existente. Devuelve el ID del anuncio creado.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del anuncio" },
        adset_id: {
          type: "string",
          description: "ID del Ad Set donde se publicará el anuncio",
        },
        creative_id: {
          type: "string",
          description: "ID del creativo (obtenido de create_ad_creative)",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "PAUSED"],
          description: "Estado inicial (default: PAUSED)",
        },
      },
      required: ["name", "adset_id", "creative_id"],
    },
  },
  {
    name: "get_ad_status",
    description:
      "Obtiene el estado y las métricas básicas de un anuncio, ad set o campaña específico.",
    inputSchema: {
      type: "object",
      properties: {
        object_id: {
          type: "string",
          description: "ID del objeto (campaña, ad set, o ad)",
        },
        object_type: {
          type: "string",
          enum: ["campaign", "adset", "ad"],
          description: "Tipo de objeto a consultar",
        },
      },
      required: ["object_id", "object_type"],
    },
  },
  {
    name: "update_ad_status",
    description:
      "Activa o pausa una campaña, ad set o anuncio existente.",
    inputSchema: {
      type: "object",
      properties: {
        object_id: {
          type: "string",
          description: "ID del objeto a actualizar",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "PAUSED"],
          description: "Nuevo estado",
        },
      },
      required: ["object_id", "status"],
    },
  },
  {
    name: "update_ad",
    description:
      "Actualiza un anuncio existente sin eliminarlo. Permite cambiar el creativo (creative_id), el nombre o el estado. CASO DE USO: cuando un creativo tiene un error (ej. falta el CTA), crea un nuevo creativo corregido y usa esta herramienta para actualizar el ad apuntando al nuevo creative_id. El ad conserva su historial de métricas.",
    inputSchema: {
      type: "object",
      properties: {
        ad_id: {
          type: "string",
          description: "ID del anuncio a actualizar",
        },
        creative_id: {
          type: "string",
          description: "ID del nuevo creativo a asociar al anuncio (reemplaza el creativo actual)",
        },
        name: {
          type: "string",
          description: "Nuevo nombre del anuncio (opcional)",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "PAUSED"],
          description: "Nuevo estado del anuncio (opcional)",
        },
      },
      required: ["ad_id"],
    },
  },

  {
    name: "list_adsets",
    description:
      "Lista los conjuntos de anuncios (Ad Sets) de una campaña específica.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: {
          type: "string",
          description: "ID de la campaña",
        },
        limit: {
          type: "number",
          description: "Máximo de resultados (default: 10)",
        },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "list_ads",
    description:
      "Lista los anuncios individuales de un Ad Set específico.",
    inputSchema: {
      type: "object",
      properties: {
        adset_id: {
          type: "string",
          description: "ID del Ad Set",
        },
        limit: {
          type: "number",
          description: "Máximo de resultados (default: 10)",
        },
      },
      required: ["adset_id"],
    },
  },

  // ─── Insights ───────────────────────────────────────────────────────────
  {
    name: "get_insights",
    description:
      "Obtiene métricas de rendimiento de Meta Ads: gasto, impresiones, clicks, CTR, CPC, CPL, leads, alcance, frecuencia, CPM. Puede consultarse a nivel de cuenta, campaña, ad set o ad individual, con rangos de fecha flexibles.",
    inputSchema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["account", "campaign", "adset", "ad"],
          description: "Nivel de agregación: 'account' (toda la cuenta), 'campaign', 'adset' o 'ad'. Default: 'account'",
        },
        object_id: {
          type: "string",
          description: "ID del objeto específico a consultar (campaign_id, adset_id, ad_id). Requerido si level no es 'account'.",
        },
        date_preset: {
          type: "string",
          enum: [
            "today",
            "yesterday",
            "last_3d",
            "last_7d",
            "last_14d",
            "last_28d",
            "last_30d",
            "last_90d",
            "this_month",
            "last_month",
            "this_quarter",
            "this_year",
          ],
          description: "Período de tiempo. Default: 'last_30d'",
        },
        fields: {
          type: "string",
          description: "Campos a obtener separados por coma. Default: 'spend,impressions,clicks,ctr,cpc,reach,frequency,cpm,actions,cost_per_action_type'. Para leads usa 'spend,actions,cost_per_action_type'.",
        },
        time_increment: {
          type: "string",
          enum: ["all_days", "1", "7", "monthly"],
          description: "Granularidad temporal: 'all_days' (total del período), '1' (diario), '7' (semanal), 'monthly'. Default: 'all_days'",
        },
        breakdown: {
          type: "string",
          enum: ["none", "age", "gender", "country", "placement", "device_platform"],
          description: "Desglose adicional de los datos. Default: 'none'",
        },
      },
    },
  },

  // ─── Delete Object ───────────────────────────────────────────────────────
  {
    name: "delete_object",
    description:
      "Elimina permanentemente una campaña, ad set o anuncio de Meta Ads. ADVERTENCIA: esta acción es irreversible. Usar solo para objetos de prueba o creados por error.",
    inputSchema: {
      type: "object",
      properties: {
        object_id: {
          type: "string",
          description: "ID del objeto a eliminar (campaign_id, adset_id o ad_id)",
        },
        object_type: {
          type: "string",
          enum: ["campaign", "adset", "ad"],
          description: "Tipo de objeto para incluir en el mensaje de confirmación",
        },
      },
      required: ["object_id"],
    },
  },
];

// ─── Tool Handlers ──────────────────────────────────────────────────────────
async function handleTool(name, args) {
  switch (name) {
    // ── List Campaigns ──
    case "list_campaigns": {
      const limit = args.limit || 10;
      const fields = "id,name,status,objective,daily_budget,lifetime_budget,created_time";
      let endpoint = `/${AD_ACCOUNT_ID}/campaigns?fields=${fields}&limit=${limit}`;
      if (args.status && args.status !== "ALL") {
        endpoint += `&filtering=[{"field":"effective_status","operator":"IN","value":["${args.status}"]}]`;
      }
      const result = await metaApi(endpoint);
      return JSON.stringify(result.data, null, 2);
    }

    // ── Create Campaign ──
    case "create_campaign": {
      const body = {
        name: args.name,
        objective: args.objective,
        special_ad_categories: args.special_ad_categories || [],
        status: args.status || "PAUSED",
        buying_type: args.buying_type || "AUCTION",
      };
      const result = await metaApi(`/${AD_ACCOUNT_ID}/campaigns`, "POST", body);
      return JSON.stringify(
        { success: true, campaign_id: result.id, message: `Campaña "${args.name}" creada exitosamente en estado ${body.status}` },
        null,
        2
      );
    }

    // ── Create Ad Set ──
    case "create_adset": {
      const body = {
        name: args.name,
        campaign_id: args.campaign_id,
        daily_budget: String(args.daily_budget),
        billing_event: args.billing_event || "IMPRESSIONS",
        optimization_goal: args.optimization_goal,
        targeting: JSON.stringify(args.targeting),
        status: args.status || "PAUSED",
      };
      if (args.start_time) body.start_time = args.start_time;
      if (args.end_time) body.end_time = args.end_time;

      const result = await metaApi(`/${AD_ACCOUNT_ID}/adsets`, "POST", body);
      return JSON.stringify(
        { success: true, adset_id: result.id, message: `Ad Set "${args.name}" creado exitosamente` },
        null,
        2
      );
    }

    // ── Upload Image ──
    case "upload_image": {
      const form = new FormData();
      const fileBuffer = readFileSync(args.image_path);
      const filename = basename(args.image_path);
      form.append("filename", fileBuffer, {
        filename,
        contentType: lookup(filename) || "image/png",
      });
      const result = await metaApi(`/${AD_ACCOUNT_ID}/adimages`, "POST", form);
      const imageData = result.images?.[filename] || Object.values(result.images || {})[0];
      return JSON.stringify(
        {
          success: true,
          image_hash: imageData?.hash,
          url: imageData?.url,
          message: `Imagen "${filename}" subida exitosamente`,
        },
        null,
        2
      );
    }

    // ── Upload Video ──
    case "upload_video": {
      const form = new FormData();
      const fileBuffer = readFileSync(args.video_path);
      const filename = basename(args.video_path);
      form.append("source", fileBuffer, {
        filename,
        contentType: "video/mp4",
      });
      if (args.title) form.append("title", args.title);
      const result = await metaApi(`/${AD_ACCOUNT_ID}/advideos`, "POST", form);
      return JSON.stringify(
        { success: true, video_id: result.id, message: `Video "${filename}" subido. Procesando...` },
        null,
        2
      );
    }

    // ── Create Ad Creative ──
    // REGLA: WhatsApp (WHATSAPP_MESSAGE CTA) → creativo estático (1 texto, 1 título).
    // Otras campañas (tráfico, reconocimiento, etc.) → Dynamic Creative (asset_feed_spec).
    case "create_ad_creative": {
      const cta = args.call_to_action || "SEND_MESSAGE";
      const link = args.link;
      const isWhatsApp = cta === "WHATSAPP_MESSAGE";

      const ctaValue = { link };
      if (args.whatsapp_phone_number) {
        ctaValue.whatsapp_phone_number = args.whatsapp_phone_number;
      }

      // ── MODO WhatsApp: creativo estático (1 texto + 1 título) ──
      if (isWhatsApp || args.no_media) {
        const linkData = {
          message: args.primary_texts[0],
          link,
          name: args.headlines[0],
          call_to_action: { type: cta, value: ctaValue },
        };
        if (args.description) linkData.description = args.description;
        if (args.image_hash) linkData.image_hash = args.image_hash;
        if (args.video_id) linkData.video_id = args.video_id;

        const body = {
          name: args.name,
          object_story_spec: { page_id: PAGE_ID, link_data: linkData },
        };
        const result = await metaApi(`/${AD_ACCOUNT_ID}/adcreatives`, "POST", body);
        return JSON.stringify(
          {
            success: true,
            creative_id: result.id,
            message: `Creativo WhatsApp estático "${args.name}" creado. (1 texto + 1 título — sin Dynamic Creative, requerido por Meta para campañas de WhatsApp)`,
          },
          null, 2
        );
      }

      // ── MODO no-WhatsApp: Dynamic Creative (hasta 5 textos + 5 títulos) ──
      const primaryTexts = args.primary_texts.slice(0, 5);
      const headlines = args.headlines.slice(0, 5);

      if (!args.image_hash && !args.video_id) {
        throw new Error("Para DCO debes proveer image_hash o video_id.");
      }

      const assetFeedSpec = {
        bodies: primaryTexts.map((text) => ({ text })),
        titles: headlines.map((text) => ({ text })),
        link_urls: [{ website_url: link, display_url: link }],
        call_to_action_types: [cta],
        ad_formats: args.image_hash ? ["SINGLE_IMAGE"] : ["SINGLE_VIDEO"],
      };
      if (args.image_hash) assetFeedSpec.images = [{ hash: args.image_hash }];
      if (args.video_id) assetFeedSpec.videos = [{ video_id: args.video_id }];

      const body = {
        name: args.name,
        asset_feed_spec: assetFeedSpec,
        object_story_spec: { page_id: PAGE_ID },
      };
      const result = await metaApi(`/${AD_ACCOUNT_ID}/adcreatives`, "POST", body);
      return JSON.stringify(
        {
          success: true,
          creative_id: result.id,
          message: `Creativo DCO "${args.name}" creado con ${primaryTexts.length} textos y ${headlines.length} títulos.`,
        },
        null, 2
      );
    }

    // ── Create Carousel Creative (Secuencia) ──
    case "create_carousel_creative": {
      const cta = args.call_to_action || "WHATSAPP_MESSAGE";
      const cards = (args.cards || []).slice(0, 10);

      if (cards.length < 2) {
        throw new Error("Un carrusel de Secuencia requiere mínimo 2 tarjetas (cards).");
      }

      const childAttachments = cards.map((card) => {
        const attachment = {
          link: card.link,
          image_hash: card.image_hash,
          name: card.title,
          call_to_action: { type: cta },
        };
        if (card.description) attachment.description = card.description;
        return attachment;
      });

      const body = {
        name: args.name,
        object_story_spec: {
          page_id: PAGE_ID,
          link_data: {
            message: args.message,
            link: cards[0].link,
            child_attachments: childAttachments,
            multi_share_end_card: false,
          },
        },
      };

      const result = await metaApi(`/${AD_ACCOUNT_ID}/adcreatives`, "POST", body);
      return JSON.stringify(
        {
          success: true,
          creative_id: result.id,
          message: `Creativo Secuencia "${args.name}" creado con ${cards.length} tarjetas.`,
        },
        null, 2
      );
    }

    // ── Create Ad ──
    case "create_ad": {

      const body = {
        name: args.name,
        adset_id: args.adset_id,
        creative: JSON.stringify({ creative_id: args.creative_id }),
        status: args.status || "PAUSED",
      };
      const result = await metaApi(`/${AD_ACCOUNT_ID}/ads`, "POST", body);
      return JSON.stringify(
        { success: true, ad_id: result.id, message: `Anuncio "${args.name}" creado exitosamente en estado ${body.status}` },
        null,
        2
      );
    }

    // ── Get Status ──
    case "get_ad_status": {
      const fieldsMap = {
        campaign: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
        adset: "id,name,status,daily_budget,optimization_goal,targeting,start_time,end_time",
        ad: "id,name,status,creative{id,name,thumbnail_url}",
      };
      const fields = fieldsMap[args.object_type] || fieldsMap.ad;
      const result = await metaApi(`/${args.object_id}?fields=${fields}`);
      return JSON.stringify(result, null, 2);
    }

    // ── Update Status ──
    case "update_ad_status": {
      const result = await metaApi(`/${args.object_id}`, "POST", {
        status: args.status,
      });
      return JSON.stringify(
        { success: result.success, message: `Estado actualizado a ${args.status}` },
        null,
        2
      );
    }

    // ── Update Ad (creative / name / status) ──
    case "update_ad": {
      const body = {};
      if (args.creative_id) body.creative = { creative_id: args.creative_id };
      if (args.name) body.name = args.name;
      if (args.status) body.status = args.status;
      if (Object.keys(body).length === 0) throw new Error("Debes especificar al menos un campo a actualizar: creative_id, name o status.");
      const result = await metaApi(`/${args.ad_id}`, "POST", body);
      return JSON.stringify(
        { success: result.success, message: `Ad ${args.ad_id} actualizado correctamente.` },
        null, 2
      );
    }


    // ── List Ad Sets ──
    case "list_adsets": {
      const limit = args.limit || 10;
      const fields = "id,name,status,daily_budget,optimization_goal,targeting";
      const result = await metaApi(
        `/${args.campaign_id}/adsets?fields=${fields}&limit=${limit}`
      );
      return JSON.stringify(result.data, null, 2);
    }

    // ── List Ads ──
    case "list_ads": {
      const limit = args.limit || 10;
      const fields = "id,name,status,creative{id,name,thumbnail_url}";
      const result = await metaApi(
        `/${args.adset_id}/ads?fields=${fields}&limit=${limit}`
      );
      return JSON.stringify(result.data, null, 2);
    }

    // ── Get Insights ──
    case "get_insights": {
      const level = args.level || "account";
      const datePreset = args.date_preset || "last_30d";
      const timeIncrement = args.time_increment || "all_days";
      const defaultFields = "spend,impressions,clicks,ctr,cpc,reach,frequency,cpm,actions,cost_per_action_type";
      const fields = args.fields || defaultFields;

      // Determinar el endpoint base según el nivel
      let baseId;
      if (level === "account") {
        baseId = AD_ACCOUNT_ID;
      } else if (args.object_id) {
        baseId = args.object_id;
      } else {
        throw new Error("Para level '" + level + "' debes proporcionar object_id");
      }

      let endpoint = `/${baseId}/insights?fields=${encodeURIComponent(fields)}&date_preset=${datePreset}&level=${level}&time_increment=${timeIncrement}`;

      // Añadir breakdown si se especificó
      if (args.breakdown && args.breakdown !== "none") {
        endpoint += `&breakdowns=${args.breakdown}`;
      }

      const result = await metaApi(endpoint);

      // Extraer métricas de leads y CPL del array 'actions' para hacerlo más legible
      const enriched = (result.data || []).map(row => {
        const enrichedRow = { ...row };
        if (row.actions) {
          const leadAction = row.actions.find(a =>
            a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
          );
          if (leadAction) enrichedRow.leads = leadAction.value;
        }
        if (row.cost_per_action_type) {
          const cpl = row.cost_per_action_type.find(a =>
            a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
          );
          if (cpl) enrichedRow.cpl = cpl.value;
        }
        return enrichedRow;
      });

      return JSON.stringify(
        {
          period: datePreset,
          level,
          object_id: baseId,
          time_increment: timeIncrement,
          data: enriched,
          summary: result.summary || null,
        },
        null, 2
      );
    }

    // ── Delete Object ──
    case "delete_object": {
      const objectType = args.object_type || "objeto";
      const result = await metaApi(`/${args.object_id}`, "DELETE");
      return JSON.stringify(
        {
          success: result.success,
          message: `${objectType} ${args.object_id} eliminado permanentemente de Meta Ads.`,
        },
        null, 2
      );
    }

    default:
      throw new Error(`Tool "${name}" no reconocida`);
  }
}

// ─── Start MCP Server ───────────────────────────────────────────────────────
const server = new Server(
  { name: "mcp-meta-ads", version: "1.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args || {});
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ─── Dual Transport: stdio (local/Cursor) o HTTP/SSE (servidor/N8N) ───────
const MODE = process.env.MCP_MODE || "stdio"; // "stdio" | "http"

if (MODE === "http") {
  // ── HTTP/SSE mode — para usar desde N8N, servidor remoto, otros agentes ──
  const { default: express } = await import("express");
  const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");

  const PORT = process.env.MCP_PORT || 3010;
  const SECRET = process.env.MCP_SECRET; // opcional: proteger con token

  const app = express();
  app.use(express.json());

  // Map para mantener una sesión SSE por cliente
  const sessions = new Map();

  // Middleware opcional de autenticación
  const authMiddleware = (req, res, next) => {
    if (!SECRET) return next();
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (token !== SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };

  // GET /sse — el cliente abre la conexión SSE
  app.get("/sse", authMiddleware, async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    sessions.set(transport.sessionId, transport);
    res.on("close", () => sessions.delete(transport.sessionId));
    await server.connect(transport);
    console.error(`[SSE] Client connected: ${transport.sessionId}`);
  });

  // POST /messages — el cliente envía mensajes MCP
  app.post("/messages", authMiddleware, async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = sessions.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // GET /health — para verificar que el server está vivo
  app.get("/health", (_, res) => {
    res.json({
      status: "ok",
      server: "mcp-meta-ads",
      version: "1.2.0",
      mode: "http",
      tools: TOOLS.length,
      account: AD_ACCOUNT_ID,
    });
  });

  app.listen(PORT, () => {
    console.error(`🚀 MCP Meta Ads Server (HTTP/SSE) corriendo en http://localhost:${PORT}`);
    console.error(`   Health: http://localhost:${PORT}/health`);
    console.error(`   SSE:    http://localhost:${PORT}/sse`);
    if (SECRET) console.error(`   Auth:   Bearer token habilitado`);
  });

} else {
  // ── stdio mode — para uso local con Cursor/Antigravity ──
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 MCP Meta Ads Server running on stdio");
}
