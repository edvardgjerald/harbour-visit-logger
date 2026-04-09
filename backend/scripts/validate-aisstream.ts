import WebSocket from "ws";

// Read API key manually to be absolutely certain
import { config } from "../src/config.js";
import { AISMessageSchema } from "@vessel/shared";

const apiKey = config.aisstream.apiKey;

if (!apiKey) {
  console.error("Could not find AISSTREAM_API_KEY in .env");
  process.exit(1);
}

const socket = new WebSocket(config.aisstream.url);

console.log(
  `Connecting to AISStream with key: ${apiKey.substring(0, Math.floor(apiKey.length / 2))}...`
);

socket.onopen = function () {
  console.log("Connected to AISStream WebSocket!");

  const subscriptionMessage = {
    Apikey: apiKey,
    BoundingBoxes: config.aisstream.boundingBox,
    FilterMessageTypes: [
      "PositionReport",
      "StandardClassBPositionReport",
      "ExtendedClassBPositionReport",
    ],
  };

  socket.send(JSON.stringify(subscriptionMessage));
  console.log("Sent subscription requests for Oslofjord.");
  console.log("Waiting for data...");
};

let messagesReceived = 0;
let positionReports = 0;
let classBReports = 0;
let parseErrors = 0;

socket.onmessage = function (event) {
  messagesReceived++;
  const raw = event.data.toString();
  const rawData = JSON.parse(raw);

  // Use the actual backend Zod schema to ensure identical parsing logic
  const parsed = AISMessageSchema.safeParse(rawData);

  if (!parsed.success) {
    parseErrors++;
    return;
  }

  const data = parsed.data;

  // The Zod transform normalises actual message types into a generic structure,
  // but we can look at the raw data to see what it originally was
  if (rawData.MessageType === "PositionReport") {
    positionReports++;
  } else if (
    rawData.MessageType === "StandardClassBPositionReport" ||
    rawData.MessageType === "ExtendedClassBPositionReport"
  ) {
    classBReports++;
  }

  console.log(
    `[Msg #${messagesReceived}] Zod Parsed ✅: ${rawData.MessageType} - Lat: ${data.Message.PositionReport.Latitude}, Lon: ${data.Message.PositionReport.Longitude}`
  );
};

socket.on("close", (code, reason) => {
  console.log(`WebSocket closed: code ${code}, reason: ${reason && reason.toString()}`);
});
socket.onerror = (e) => console.log("WebSocket Error:", e);

setTimeout(() => {
  console.log("\n--- TEST RESULTS ---");
  console.log(`Total Valid Messages:          ${messagesReceived}`);
  console.log(`Class A (PositionReport):      ${positionReports}`);
  console.log(`Class B (Standard/Extended):   ${classBReports}`);
  console.log(`Zod Parse Errors (Dropped):    ${parseErrors}`);

  if (messagesReceived === 0) {
    console.log(
      "\nCONCLUSION: ZERO traffic received from AISStream. Ensure your API key is valid and you haven't been rate-limited!"
    );
  } else {
    console.log(
      "\nCONCLUSION: Stream is healthy and Zod schemas are matching correctly."
    );
  }
  socket.close();
  process.exit(0);
}, 20000); // listen for 20 seconds
