import fetch from "node-fetch";
import FormData from "form-data";
import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { lookup } from "mime-types";

const TOKEN = "EAAWaWjOPihgBQZBsNun3yWUiW9ybIpZBLOaWsxt2bGTI0uicAlZCAZB4wSXGQxbztbdoyYr47cZCz19ggxSYcUyvR803hYY4kaZBvHZCXl4Lh7TzZAIH6xsbk2Nmi05SGs40bOk0cQ7Rlz5CGXrYgOLv6G32RXWgG5ZAuQWVtazkBxghevyUDkjL2Oc1tmlQ6BgZDZD";
const ACC = "act_2695142834174710";
const API_URL = `https://graph.facebook.com/v25.0/${ACC}/adimages`;

const IMAGES = {
    "IMAGEN_01": "/Volumes/LuisD/Bts/Antigravity/Estrategias Meta Ads/Altiore Group/Assets/IMAGENES/IMAGEN 01.png",
    "IMAGEN_02": "/Volumes/LuisD/Bts/Antigravity/Estrategias Meta Ads/Altiore Group/Assets/IMAGENES/IMAGEN 02.png",
    "HISTORIAS_07": "/Volumes/LuisD/Bts/Antigravity/Estrategias Meta Ads/Altiore Group/Assets/IMAGENES/HISTORIAS-07.png"
};

async function upload() {
    const hashes = {};
    for (const [name, path] of Object.entries(IMAGES)) {
        console.log(`Subiendo ${name}...`);
        try {
            const form = new FormData();
            const fileBuffer = readFileSync(path);
            const filename = basename(path);

            form.append("filename", fileBuffer, {
                filename,
                contentType: lookup(filename) || "image/png",
            });
            form.append("access_token", TOKEN);

            const res = await fetch(API_URL, {
                method: "POST",
                body: form,
                headers: form.getHeaders(),
            });

            const json = await res.json();
            if (json.images) {
                const key = Object.keys(json.images)[0];
                const hash = json.images[key].hash;
                hashes[name] = hash;
                console.log(`✅ EXITO -> ${name}: ${hash}`);
            } else {
                console.error(`❌ ERROR -> ${name}:`, json);
            }
        } catch (e) {
            console.error(`❌ ERROR DE RED -> ${name}:`, e.message);
        }
    }

    writeFileSync("image_hashes.json", JSON.stringify(hashes, null, 2));
    console.log("\nGuardado en image_hashes.json");
}

upload();
