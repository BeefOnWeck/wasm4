import { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async ({ body, requestContext }) => {
  async function sendToPeer (source: string, target: string, message: object) {
    const client = new ApiGatewayManagementApiClient({
      apiVersion: "2018-11-29",
      endpoint: process.env.IS_OFFLINE
        ? "http://localhost:3001"
        : requestContext.domainName.endsWith(".wasm4.org")
        ? `https://${requestContext.apiId}.execute-api.us-east-1.amazonaws.com/${requestContext.stage}`
        : `https://${requestContext.domainName}/${requestContext.stage}`,
      credentials: process.env.IS_OFFLINE
        ? { accessKeyId: "offline", secretAccessKey: "offline" }
        : undefined,
    });
    await client.send(new PostToConnectionCommand({
      Data: JSON.stringify({ source, message }),
      ConnectionId: target,
    }));
  }

  if (body) {
    const { target, message } = JSON.parse(body);

    if (message.type === "WHOAMI_REQUEST") {
      await sendToPeer("server", requestContext.connectionId, {
        type: "WHOAMI_REPLY",
        yourPeerId: requestContext.connectionId,
      });
    } else {
      try {
        await sendToPeer(requestContext.connectionId, target, message);
      } catch (error) {
        // Peer not found, send an abort message
        await sendToPeer(target, requestContext.connectionId, {
          type: "ABORT",
        });
      }
    }
  }

  return {
    statusCode: 200,
  }
}
