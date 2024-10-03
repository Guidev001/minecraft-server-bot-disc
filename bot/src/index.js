const { Client, GatewayIntentBits } = require("discord.js");
const { exec } = require("child_process");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.DISCORD_TOKEN;

client.once("ready", () => {
  console.info("Bot está online!");
});

async function getNgrokUrl() {
  try {
    const response = await axios.get("http://localhost:4040/api/tunnels");
    const tunnels = response.data.tunnels;
    const tcpTunnel = tunnels.find((t) => t.proto === "tcp");

    if (tcpTunnel) {
      const publicUrl = tcpTunnel.public_url;
      const [host, port] = publicUrl.replace("tcp://", "").split(":");
      return { host, port };
    }
    return null;
  } catch (error) {
    console.error("Erro ao obter URL do Ngrok:", error.message);
    return null;
  }
}

async function checkServerStatus(message) {
  exec("docker ps", async (error, stdout, stderr) => {
    if (error) return message.reply("❌ Servidor não está ativo no momento, favor fazer o pix pro Gui pra manter 24h online")

    if (stdout.includes("mc-server") && stdout.includes("ngrok")) {
      const ngrokUrl = await getNgrokUrl();
      if (ngrokUrl) {
        message.reply("🟡 Obtendo endereço Ngrok...");
        message.reply(`
        🟢 Servidor Minecraft online!
        IP: ${ngrokUrl.host.replace("tcp://", "") + ":" + ngrokUrl.port}
        Versão: ${process.env.MINECRAFT_VERSION}
        Jogadores Máximos: ${process.env.MINECRAFT_MAX_PLAYERS}
        Dificuldade: ${process.env.MINECRAFT_DIFFICULTY}
        MOTD: ${process.env.MINECRAFT_MOTD}`);
      } else {
        message.reply(
          "❌ Servidor Minecraft online, mas não foi possível obter o endereço Ngrok."
        );
      }
    } else {
      message.reply("❌ Servidor Minecraft ou Ngrok não estão rodando.");
    }
  });
}

client.on("messageCreate", async (message) => {
  if (message.content.startsWith("!")) {
    const command = message.content.slice(1).toLowerCase();
    const dockerComposePath = path.join(
      __dirname,
      "..",
      "..",
      "docker",
      "docker-compose.yml"
    );

    const isAdmin = message.member.permissions.has("Administrator");

    switch (command) {
      case "status":
        checkServerStatus(message);
        break;

      case "start":
        message.reply("🟡 Iniciando o servidor Minecraft e Ngrok...");
        exec(
          `docker-compose -f ${dockerComposePath} up -d`,
          (error, stderr) => {
            if (error) {
              return message.reply(`❌ Erro ao iniciar o servidor: ${stderr}`);
            }
            message.reply("🟡 Montando e subindo os containers...");
            setTimeout(() => checkServerStatus(message), 30000);
          }
        );
        break;

      case "stop":
        if (!isAdmin) {
          return message.reply(
            "❌ Você não tem permissão para usar este comando."
          );
        }
        message.reply("Encerrando servidor...");
        exec(
          `docker-compose -f ${dockerComposePath} down`,
          (error, stderr) => {
            if (error) {
              return message.reply(`❌ Erro ao parar o servidor: ${stderr}`);
            }
            return message.reply("🟢 Servidor Minecraft parado com sucesso!");
          }
        );
        break;

      case "restart":
        if (!isAdmin) {
          return message.reply(
            "❌ Você não tem permissão para usar este comando."
          );
        }
        exec(
          `docker-compose -f ${dockerComposePath} restart`,
          (error, stderr) => {
            if (error) {
              return message.reply(
                `❌ Erro ao reiniciar o servidor: ${stderr}`
              );
            }
            return message.reply(
              "🟢 Servidor Minecraft reiniciado com sucesso!"
            );
          }
        );
        break;
      case "logs":
        if (!isAdmin) {
          return message.reply(
            "❌ Você não tem permissão para usar este comando."
          );
        }
        exec(`docker logs mc-server`, (error, stdout, stderr) => {
          if (error) {
            return message.reply(
              `❌ Erro ao exibir logs do servidor: ${stderr}`
            );
          }
          return message.reply(`🟡Logs do servidor: ${stdout}`);
        });
        break;
    }
  }
});

client.login(TOKEN);
