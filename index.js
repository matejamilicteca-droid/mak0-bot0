require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");
const Parser = require("rss-parser");

// ======================================================
// CLIENT
// ======================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const parser = new Parser();

// ======================================================
// CONFIG
// ======================================================
const GUILD_ID = "1268351410362257480";

const ROLE_CHANNEL_ID = "1445528606515138590";
const TICKET_PANEL_CHANNEL_ID = "1445546740861370511";
const TICKET_CATEGORY_ID = "1445546316317986928";

const MOD_LOG_CHANNEL_ID = "1445546978321633310";
const BAN_LOG_CHANNEL_ID = "1445547007375708161";
const WELCOME_CHANNEL_ID = "1444751843556196474";

const YOUTUBE_NOTIFICATION_CHANNEL_ID = "1477961000710963291";
const YOUTUBE_CHANNEL_ID = "UCOGk-HZSOuCh6c6sH1Ibm3Q";
const YOUTUBE_CHANNEL_URL = "https://youtube.com/@mak0_m.m?si=4Fu5oH31pEoJs4HF";
const YOUTUBE_CHANNEL_TAG = "@Mak0_M.M";
const YOUTUBE_POLL_INTERVAL_MS = 2 * 60 * 1000;

const AUTO_MEMBER_ROLE_ID = "1445771187119722657"; // 💎| Member

const ROLES = {
  srbija: "1445551513455034459",
  bosna: "1445551990980612096",
  hrvatska: "1445552126867800145",
  crnagora: "1445552267716460604",
};

const LEVEL_ROLES = {
  lvl1: "1444749960032813056",
  lvl2: "1444750747395686502",
  super: "1444750333661151424",
};

const LEVEL_REQUIREMENTS = {
  lvl1: {
    label: "Mak0 Member Lvl 1",
    messages: 20,
    images: 1,
    roleId: LEVEL_ROLES.lvl1,
  },
  lvl2: {
    label: "Mak0 Member Lvl 2",
    messages: 30,
    images: 5,
    roleId: LEVEL_ROLES.lvl2,
  },
  super: {
    label: "Mak0 Super Member",
    messages: 50,
    images: 10,
    roleId: LEVEL_ROLES.super,
  },
};

const FULL_ADMIN_ROLE_IDS = [
  "1444747040415416400", // Owner
  "1444747352412917941", // Deputy Owner
  "1444747684664840365", // Admin Lvl. 3
];

const LIMITED_ADMIN_ROLE_IDS = [
  "1444747883768447097", // Admin Lvl. 2
  "1444747820337991680", // Admin Lvl. 1
];

const USERINFO_ALLOWED_ROLE_IDS = [
  ...FULL_ADMIN_ROLE_IDS,
  "1444747883768447097", // Admin Lvl. 2
];

const TICKET_VIEW_ROLE_IDS = [...FULL_ADMIN_ROLE_IDS];

const FULL_ADMIN_COMMANDS = new Set([
  "ban",
  "kick",
  "timeout",
  "untimeout",
  "warn",
  "unwarn",
  "warnings",
  "clear",
  "sendlatestvideo",
  "userinfo",
]);

const LIMITED_ADMIN_COMMANDS = new Set([
  "kick",
  "timeout",
  "untimeout",
  "warn",
  "unwarn",
  "warnings",
  "clear",
]);

const DATA_FILE = path.join(__dirname, "bot_data.json");

const ANTI_SPAM = {
  INTERVAL_MS: 7000,
  MAX_MESSAGES: 9,
  TIMEOUT_MINUTES: 6,
};

const ANTI_CAPS = {
  MIN_LENGTH: 15,
  UPPERCASE_RATIO: 0.7,
  TIMEOUT_MINUTES: 2,
};

const ANTI_INVITE = {
  ENABLED: true,
  DELETE_MESSAGE: true,
  TIMEOUT_MINUTES: 5,
};

const INVITE_REGEX =
  /(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/gi;

const DEDUPE = {
  WELCOME_MS: 15000,
  MOD_LOG_MS: 8000,
  AUTO_KICK_MS: 15000,
  LEVEL_UP_MS: 15000,
  INTERACTION_MS: 60000,
};

// ======================================================
// RUNTIME STATE
// ======================================================
let lastYoutubeVideoId = null;
let youtubeInterval = null;

const messageTracker = new Map();
const inviteCache = new Map();
const runtimeDedupe = new Map();
const processedInteractions = new Set();

// ======================================================
// DATA
// ======================================================
let botData = {
  warns: {},
  stats: {},
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), "utf8");
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    botData = {
      warns: parsed.warns || {},
      stats: parsed.stats || {},
    };
  } catch (err) {
    console.error("❌ Greška pri učitavanju bot_data.json:", err);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2), "utf8");
  } catch (err) {
    console.error("❌ Greška pri čuvanju bot_data.json:", err);
  }
}

loadData();

// ======================================================
// DEDUPE HELPERS
// ======================================================
function shouldSkipDuplicate(key, ttlMs) {
  const now = Date.now();
  const last = runtimeDedupe.get(key);

  if (last && now - last < ttlMs) {
    return true;
  }

  runtimeDedupe.set(key, now);
  return false;
}

function markInteractionProcessed(interactionId) {
  if (processedInteractions.has(interactionId)) return false;

  processedInteractions.add(interactionId);

  setTimeout(() => {
    processedInteractions.delete(interactionId);
  }, DEDUPE.INTERACTION_MS);

  return true;
}

function cleanupRuntimeMaps() {
  const now = Date.now();

  for (const [key, time] of runtimeDedupe.entries()) {
    if (now - time > 60000) {
      runtimeDedupe.delete(key);
    }
  }
}

setInterval(cleanupRuntimeMaps, 30000);

// ======================================================
// GENERAL HELPERS
// ======================================================
function hasAnyRole(member, roleIds) {
  return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

function isFullAdmin(member) {
  return hasAnyRole(member, FULL_ADMIN_ROLE_IDS);
}

function isLimitedAdmin(member) {
  return hasAnyRole(member, LIMITED_ADMIN_ROLE_IDS);
}

function isStaff(member) {
  return isFullAdmin(member) || isLimitedAdmin(member);
}

function canUseCommand(member, commandName) {
  if (commandName === "userinfo") {
    return hasAnyRole(member, USERINFO_ALLOWED_ROLE_IDS);
  }

  if (isFullAdmin(member)) return FULL_ADMIN_COMMANDS.has(commandName);
  if (isLimitedAdmin(member)) return LIMITED_ADMIN_COMMANDS.has(commandName);
  return false;
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  return parts.join(" ") || "0m";
}

function formatJoinDate(date) {
  if (!date) return "Nepoznato";

  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sanitizeChannelName(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

function getWarnings(userId) {
  if (!botData.warns[userId]) botData.warns[userId] = [];
  return botData.warns[userId];
}

function getUserStats(userId) {
  if (!botData.stats[userId]) {
    botData.stats[userId] = {
      cycleMessages: 0,
      cycleImages: 0,
      totalMessages: 0,
      totalImages: 0,
      lastPromotionAt: null,
      joinedBy: "Nepoznato",
      joinedByCode: "Nepoznato",
      joinedAt: null,
    };
  }

  return botData.stats[userId];
}

function resetCycleStats(userId) {
  const stats = getUserStats(userId);
  stats.cycleMessages = 0;
  stats.cycleImages = 0;
  stats.lastPromotionAt = new Date().toISOString();
  saveData();
}

function isAllCapsMessage(content) {
  const letters = content.replace(/[^a-zA-ZšđčćžŠĐČĆŽ]/g, "");
  if (letters.length < ANTI_CAPS.MIN_LENGTH) return false;

  const upper = letters.split("").filter((c) => c === c.toUpperCase()).length;
  const ratio = upper / letters.length;

  return ratio >= ANTI_CAPS.UPPERCASE_RATIO;
}

function countImageAttachments(message) {
  if (!message.attachments?.size) return 0;

  return [...message.attachments.values()].filter((attachment) => {
    const contentType = attachment.contentType || "";
    return contentType.startsWith("image/");
  }).length;
}

function getRoleMentionOrName(guild, roleId) {
  const role = guild.roles.cache.get(roleId);
  return role ? `<@&${role.id}>` : "Nepoznata rola";
}

function getNextLevelKey(member) {
  if (!member.roles.cache.has(LEVEL_ROLES.lvl1)) return "lvl1";
  if (!member.roles.cache.has(LEVEL_ROLES.lvl2)) return "lvl2";
  if (!member.roles.cache.has(LEVEL_ROLES.super)) return "super";
  return null;
}

function meetsRequirement(stats, requirement) {
  return (
    stats.cycleMessages >= requirement.messages &&
    stats.cycleImages >= requirement.images
  );
}

async function safeSend(channel, payload) {
  try {
    return await channel.send(payload);
  } catch (err) {
    console.error("❌ Greška pri slanju poruke:", err);
    return null;
  }
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    }
    return await interaction.reply(payload);
  } catch (err) {
    console.error("❌ Greška pri reply/editReply:", err);
    return null;
  }
}

async function safeDM(user, payload) {
  try {
    return await user.send(payload);
  } catch (err) {
    console.error(`❌ Ne mogu da pošaljem DM korisniku ${user.tag}:`, err.message);
    return null;
  }
}

async function logToChannel(guild, channelId, embed, dedupeKey = null) {
  try {
    if (dedupeKey && shouldSkipDuplicate(`log:${dedupeKey}`, DEDUPE.MOD_LOG_MS)) {
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ Greška pri logovanju:", err);
  }
}

async function logModeration(guild, embed, dedupeKey = null) {
  await logToChannel(guild, MOD_LOG_CHANNEL_ID, embed, dedupeKey);
}

async function logBan(guild, embed, dedupeKey = null) {
  await logToChannel(guild, BAN_LOG_CHANNEL_ID, embed, dedupeKey);
}

async function getFreshMember(interaction) {
  return await interaction.guild.members.fetch(interaction.user.id);
}

// ======================================================
// EMBEDS / COMPONENTS
// ======================================================
function buildRoleEmbed() {
  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("🎭 Role Request")
    .setDescription(
      [
        "Izaberi svoju državu klikom na dugme ispod.",
        "",
        "🇷🇸 Srbija",
        "🇧🇦 Bosna",
        "🇭🇷 Hrvatska",
        "🇲🇪 Crna Gora",
        "",
        "✅ Možeš imati samo jednu country rolu.",
      ].join("\n")
    )
    .setFooter({ text: "Mak0 Community • Role sistem" })
    .setTimestamp();
}

function buildRoleButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("srbija")
      .setLabel("Srbija")
      .setEmoji("🇷🇸")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("bosna")
      .setLabel("Bosna")
      .setEmoji("🇧🇦")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("hrvatska")
      .setLabel("Hrvatska")
      .setEmoji("🇭🇷")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("crnagora")
      .setLabel("Crna Gora")
      .setEmoji("🇲🇪")
      .setStyle(ButtonStyle.Success)
  );
}

function buildTicketPanelEmbed() {
  return new EmbedBuilder()
    .setColor("#57F287")
    .setTitle("🎫 Napravi Ticket")
    .setDescription(
      [
        "Klikni dugme ispod da otvoriš privatni ticket.",
        "",
        "👀 Ticket vide samo:",
        "• ti",
        "• Owner",
        "• Deputy Owner",
        "• Admin Lvl. 3",
        "",
        "📝 Posle otvaranja bot šalje format koji treba da popuniš.",
      ].join("\n")
    )
    .setFooter({ text: "Mak0 Community • Support sistem" })
    .setTimestamp();
}

function buildTicketPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("Otvori Ticket")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Success)
  );
}

function buildCloseTicketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Zatvori Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );
}

function buildWelcomeEmbed(member) {
  return new EmbedBuilder()
    .setColor("#57F287")
    .setTitle("🎉 Dobrodošao/la u Mak0 Community")
    .setDescription(
      [
        `Dobro došao/la u Mak0 Community ${member}, lepo se provedi!`,
        "",
        "🎭 U role request kanalu možeš dobiti svoju country rolu.",
        "📌 Samo klikni na dugme i izaberi državu.",
      ].join("\n")
    )
    .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
    .setFooter({ text: "Mak0 Community" })
    .setTimestamp();
}

function buildPromotionEmbed(requirement, stats) {
  return new EmbedBuilder()
    .setColor("#57F287")
    .setTitle("🎉 Napredovao/la si!")
    .setDescription(
      [
        `Bravo! Otključao/la si **${requirement.label}**.`,
        "",
        "✅ Tvoj task je uspešno završen.",
        "🔁 Progress za sledeći nivo je resetovan na nulu.",
        "",
        `💬 Poruke u ciklusu: **${stats.cycleMessages}**`,
        `🖼️ Slike u ciklusu: **${stats.cycleImages}**`,
      ].join("\n")
    )
    .setFooter({ text: "Mak0 Community • Leveling sistem" })
    .setTimestamp();
}

function buildYouTubeEmbed(video) {
  const videoId = extractVideoId(video);
  const thumbnail =
    video?.enclosure?.url ||
    video?.thumbnail ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

  const embed = new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("📹 Novi video je objavljen!")
    .setURL(video.link)
    .setDescription(
      [
        `**${YOUTUBE_CHANNEL_TAG}** je upravo objavio novi video.`,
        "",
        `🎬 **Naslov:** [${video.title}](${video.link})`,
        "",
        `🔗 **Pogledaj ovde:** ${video.link}`,
        `📺 **YouTube kanal:** ${YOUTUBE_CHANNEL_URL}`,
      ].join("\n")
    )
    .setFooter({ text: "Mak0 Community • YouTube obaveštenja" })
    .setTimestamp(video.isoDate ? new Date(video.isoDate) : new Date());

  if (thumbnail) embed.setImage(thumbnail);

  return embed;
}

// ======================================================
// YOUTUBE HELPERS
// ======================================================
function extractVideoId(video) {
  if (!video) return null;

  if (video.id && video.id.includes(":")) {
    return video.id.split(":").pop();
  }

  if (video.link) {
    try {
      const url = new URL(video.link);
      return url.searchParams.get("v");
    } catch {
      return null;
    }
  }

  return null;
}

// ======================================================
// TICKETS
// ======================================================
async function findExistingUserTicket(guild, userId) {
  const channels = guild.channels.cache.filter(
    (ch) =>
      ch.parentId === TICKET_CATEGORY_ID &&
      ch.type === ChannelType.GuildText &&
      ch.permissionOverwrites.cache.has(userId)
  );

  return channels.first() || null;
}

// ======================================================
// INVITES
// ======================================================
async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(
      guild.id,
      new Map(invites.map((invite) => [invite.code, invite.uses]))
    );
  } catch (err) {
    console.error("❌ Ne mogu da učitam invite cache:", err.message);
  }
}

async function detectUsedInvite(member) {
  try {
    const oldInvites = inviteCache.get(member.guild.id) || new Map();
    const newInvites = await member.guild.invites.fetch();

    let usedInvite = null;

    for (const invite of newInvites.values()) {
      const oldUses = oldInvites.get(invite.code) || 0;
      if (invite.uses > oldUses) {
        usedInvite = invite;
        break;
      }
    }

    inviteCache.set(
      member.guild.id,
      new Map(newInvites.map((invite) => [invite.code, invite.uses]))
    );

    return usedInvite;
  } catch (err) {
    console.error("❌ Greška pri detekciji invite linka:", err.message);
    return null;
  }
}

// ======================================================
// LEVELING
// ======================================================
async function checkAndApplyLevelUp(member) {
  const nextLevelKey = getNextLevelKey(member);
  if (!nextLevelKey) return;

  const stats = getUserStats(member.id);
  const requirement = LEVEL_REQUIREMENTS[nextLevelKey];

  if (!meetsRequirement(stats, requirement)) return;

  const dedupeKey = `levelup:${member.guild.id}:${member.id}:${nextLevelKey}`;
  if (shouldSkipDuplicate(dedupeKey, DEDUPE.LEVEL_UP_MS)) return;

  try {
    const roleToAdd = member.guild.roles.cache.get(requirement.roleId);
    if (!roleToAdd) return;

    const rolesToRemove = [];

    if (nextLevelKey === "lvl2" && member.roles.cache.has(LEVEL_ROLES.lvl1)) {
      rolesToRemove.push(LEVEL_ROLES.lvl1);
    }

    if (nextLevelKey === "super") {
      if (member.roles.cache.has(LEVEL_ROLES.lvl1)) rolesToRemove.push(LEVEL_ROLES.lvl1);
      if (member.roles.cache.has(LEVEL_ROLES.lvl2)) rolesToRemove.push(LEVEL_ROLES.lvl2);
    }

    if (rolesToRemove.length) {
      await member.roles.remove(rolesToRemove).catch(() => null);
    }

    if (!member.roles.cache.has(roleToAdd.id)) {
      await member.roles.add(roleToAdd);
    }

    const promotionEmbed = buildPromotionEmbed(requirement, stats);

    await safeDM(member.user, {
      embeds: [promotionEmbed],
    });

    const logEmbed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("📈 Level up")
      .addFields(
        { name: "Korisnik", value: `${member.user.tag}`, inline: true },
        { name: "Nova rola", value: `${getRoleMentionOrName(member.guild, requirement.roleId)}`, inline: true },
        { name: "Poruke u ciklusu", value: `${stats.cycleMessages}`, inline: true },
        { name: "Slike u ciklusu", value: `${stats.cycleImages}`, inline: true }
      )
      .setTimestamp();

    await logModeration(
      member.guild,
      logEmbed,
      `levelup:${member.id}:${requirement.roleId}`
    );

    resetCycleStats(member.id);
  } catch (err) {
    console.error("❌ Greška u leveling sistemu:", err);
  }
}

// ======================================================
// PANELS
// ======================================================
async function ensureRolePanel(guild) {
  const roleChannel = guild.channels.cache.get(ROLE_CHANNEL_ID);
  if (!roleChannel || roleChannel.type !== ChannelType.GuildText) {
    console.log("⚠️ Role channel nije pronađen.");
    return;
  }

  try {
    const messages = await roleChannel.messages.fetch({ limit: 20 });

    const existingPanel = messages.find((msg) => {
      if (msg.author?.id !== client.user.id) return false;
      if (!msg.embeds.length || !msg.components.length) return false;
      return msg.embeds[0]?.title === "🎭 Role Request";
    });

    if (existingPanel) {
      console.log("✅ Role panel već postoji.");
      return;
    }

    await roleChannel.send({
      embeds: [buildRoleEmbed()],
      components: [buildRoleButtons()],
    });

    console.log("✅ Role panel poslat.");
  } catch (err) {
    console.error("❌ Greška pri role panelu:", err);
  }
}

async function ensureTicketPanel(guild) {
  const panelChannel = guild.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
  if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
    console.log("⚠️ Ticket panel kanal nije pronađen.");
    return;
  }

  try {
    const messages = await panelChannel.messages.fetch({ limit: 20 });

    const existingPanel = messages.find((msg) => {
      if (msg.author?.id !== client.user.id) return false;
      if (!msg.embeds.length || !msg.components.length) return false;
      return msg.embeds[0]?.title === "🎫 Napravi Ticket";
    });

    if (existingPanel) {
      console.log("✅ Ticket panel već postoji.");
      return;
    }

    await panelChannel.send({
      embeds: [buildTicketPanelEmbed()],
      components: [buildTicketPanelButtons()],
    });

    console.log("✅ Ticket panel poslat.");
  } catch (err) {
    console.error("❌ Greška pri ticket panelu:", err);
  }
}

// ======================================================
// YOUTUBE
// ======================================================
async function getLatestYouTubeVideo() {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
  const feed = await parser.parseURL(feedUrl);

  if (!feed || !feed.items || !feed.items.length) return null;

  const latest = feed.items[0];
  const latestVideoId = extractVideoId(latest);

  if (!latestVideoId) return null;

  return {
    video: latest,
    videoId: latestVideoId,
  };
}

async function sendYouTubeNotification(guild, video) {
  const channel = guild.channels.cache.get(YOUTUBE_NOTIFICATION_CHANNEL_ID);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const embed = buildYouTubeEmbed(video);

  await safeSend(channel, {
    content: "🚨 **Novi Mak0 video!**",
    embeds: [embed],
  });
}

async function initYouTubeNotifier() {
  try {
    const latest = await getLatestYouTubeVideo();
    if (!latest) return;

    lastYoutubeVideoId = latest.videoId;
    console.log("✅ YouTube notifier inicijalizovan.");
  } catch (err) {
    console.error("❌ Greška pri inicijalizaciji YouTube notifiera:", err);
  }
}

async function checkYouTubeUploads(guild) {
  try {
    const latest = await getLatestYouTubeVideo();
    if (!latest) return;

    if (!lastYoutubeVideoId) {
      lastYoutubeVideoId = latest.videoId;
      return;
    }

    if (latest.videoId === lastYoutubeVideoId) return;

    lastYoutubeVideoId = latest.videoId;
    await sendYouTubeNotification(guild, latest.video);
  } catch (err) {
    console.error("❌ Greška u proveri YouTube videa:", err);
  }
}

async function forceSendLatestVideo(guild) {
  try {
    const latest = await getLatestYouTubeVideo();
    if (!latest) return false;

    lastYoutubeVideoId = latest.videoId;
    await sendYouTubeNotification(guild, latest.video);
    return true;
  } catch (err) {
    console.error("❌ Greška pri force slanju videa:", err);
    return false;
  }
}

function startYouTubeNotifier(guild) {
  initYouTubeNotifier();

  if (youtubeInterval) clearInterval(youtubeInterval);

  youtubeInterval = setInterval(() => {
    checkYouTubeUploads(guild);
  }, YOUTUBE_POLL_INTERVAL_MS);
}

// ======================================================
// SLASH COMMAND REGISTRATION
// ======================================================
async function registerSlashCommands() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.log("⚠️ CLIENT_ID ili DISCORD_TOKEN fale, preskačem slash registraciju.");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Banuj korisnika")
      .addUserOption((option) =>
        option.setName("korisnik").setDescription("Korisnik").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("razlog").setDescription("Razlog").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick korisnika")
      .addUserOption((option) =>
        option.setName("korisnik").setDescription("Korisnik").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("razlog").setDescription("Razlog").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Timeout korisnika")
      .addUserOption((option) =>
        option.setName("korisnik").setDescription("Korisnik").setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName("minuta").setDescription("Broj minuta").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("razlog").setDescription("Razlog").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("untimeout")
      .setDescription("Ukloni timeout")
      .addUserOption((option) =>
        option.setName("korisnik").setDescription("Korisnik").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Dodaj warn")
      .addUserOption((option) =>
        option.setName("korisnik").setDescription("Korisnik").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("razlog").setDescription("Razlog").setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("unwarn")
      .setDescription("Ukloni warn")
      .addUserOption((option) =>
        option.setName("korisnik").setDescription("Korisnik").setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName("broj").setDescription("Broj warna").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("warnings")
      .setDescription("Prikaži warnove korisnika")
      .addUserOption((option) =>
        option.setName("korisnik").setDescription("Korisnik").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("clear")
      .setDescription("Obriši poruke")
      .addIntegerOption((option) =>
        option.setName("broj").setDescription("Broj poruka").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("sendlatestvideo")
      .setDescription("Pošalji najnoviji YouTube video"),

    new SlashCommandBuilder()
      .setName("userinfo")
      .setDescription("Prikaži info o korisniku")
      .addUserOption((option) =>
        option.setName("korisnik").setDescription("Korisnik").setRequired(true)
      ),
  ].map((cmd) => cmd.toJSON());

  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Slash komande registrovane.");
  } catch (err) {
    console.error("❌ Greška pri registraciji slash komandi:", err);
  }
}

// ======================================================
// READY
// ======================================================
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} je online | PID: ${process.pid} | ${new Date().toISOString()}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.log("❌ Guild nije pronađen.");
    return;
  }

  await registerSlashCommands();
  await ensureRolePanel(guild);
  await ensureTicketPanel(guild);
  await cacheGuildInvites(guild);
  startYouTubeNotifier(guild);
});

// ======================================================
// MEMBER JOIN
// ======================================================
client.on(Events.GuildMemberAdd, async (member) => {
  const dedupeKey = `welcome:${member.guild.id}:${member.id}`;

  if (shouldSkipDuplicate(dedupeKey, DEDUPE.WELCOME_MS)) {
    return;
  }

  try {
    const autoRole = member.guild.roles.cache.get(AUTO_MEMBER_ROLE_ID);

    if (autoRole) {
      await member.roles.add(autoRole).catch((err) => {
        console.error("❌ Greška pri dodeli auto role:", err);
      });
    } else {
      console.log("⚠️ Auto member rola nije pronađena.");
    }

    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);

    if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
      await safeSend(welcomeChannel, {
        embeds: [buildWelcomeEmbed(member)],
      });
    }

    const stats = getUserStats(member.id);
    stats.joinedAt = new Date().toISOString();

    const usedInvite = await detectUsedInvite(member);

    if (usedInvite) {
      stats.joinedBy = usedInvite.inviter ? `${usedInvite.inviter.tag}` : "Nepoznato";
      stats.joinedByCode = usedInvite.code || "Nepoznato";
    } else {
      stats.joinedBy = "Nepoznato";
      stats.joinedByCode = "Nepoznato";
    }

    saveData();
  } catch (err) {
    console.error("❌ Greška u welcome/invite/autorole sistemu:", err);
  }
});

client.on(Events.InviteCreate, async (invite) => {
  try {
    const guildMap = inviteCache.get(invite.guild.id) || new Map();
    guildMap.set(invite.code, invite.uses || 0);
    inviteCache.set(invite.guild.id, guildMap);
  } catch (err) {
    console.error("❌ Greška na InviteCreate:", err);
  }
});

client.on(Events.InviteDelete, async (invite) => {
  try {
    const guildMap = inviteCache.get(invite.guild.id) || new Map();
    guildMap.delete(invite.code);
    inviteCache.set(invite.guild.id, guildMap);
  } catch (err) {
    console.error("❌ Greška na InviteDelete:", err);
  }
});

// ======================================================
// MESSAGE CREATE
// ======================================================
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;

  const member = message.member;
  if (!member) return;

  try {
    if (!isStaff(member) && ANTI_INVITE.ENABLED && INVITE_REGEX.test(message.content)) {
      const durationMs = ANTI_INVITE.TIMEOUT_MINUTES * 60 * 1000;

      if (ANTI_INVITE.DELETE_MESSAGE) {
        await message.delete().catch(() => null);
      }

      await member.timeout(durationMs, "Slanje Discord invite linka").catch(() => null);

      const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🚫 Anti Invite")
        .addFields(
          { name: "Korisnik", value: `${message.author.tag}`, inline: true },
          { name: "Trajanje", value: formatDuration(durationMs), inline: true },
          { name: "Razlog", value: "Slanje Discord invite linka", inline: false }
        )
        .setTimestamp();

      await logModeration(
        message.guild,
        embed,
        `invite:${message.author.id}:${message.id}`
      );
      return;
    }

    if (!isStaff(member)) {
      if (isAllCapsMessage(message.content)) {
        const durationMs = ANTI_CAPS.TIMEOUT_MINUTES * 60 * 1000;

        await member.timeout(durationMs, "All caps spam").catch(() => null);
        await message.delete().catch(() => null);

        const embed = new EmbedBuilder()
          .setColor("#FEE75C")
          .setTitle("🔇 Auto Timeout - All Caps")
          .addFields(
            { name: "Korisnik", value: `${message.author.tag}`, inline: true },
            { name: "Trajanje", value: formatDuration(durationMs), inline: true },
            { name: "Razlog", value: "Previše ALL CAPS poruka", inline: false }
          )
          .setTimestamp();

        await logModeration(
          message.guild,
          embed,
          `allcaps:${message.author.id}:${message.id}`
        );
        return;
      }

      const now = Date.now();
      const userId = message.author.id;

      if (!messageTracker.has(userId)) {
        messageTracker.set(userId, []);
      }

      const timestamps = messageTracker
        .get(userId)
        .filter((ts) => now - ts < ANTI_SPAM.INTERVAL_MS);

      timestamps.push(now);
      messageTracker.set(userId, timestamps);

      if (timestamps.length >= ANTI_SPAM.MAX_MESSAGES) {
        const durationMs = ANTI_SPAM.TIMEOUT_MINUTES * 60 * 1000;

        await member.timeout(durationMs, "Spam").catch(() => null);
        await message.channel.bulkDelete(5, true).catch(() => null);
        messageTracker.set(userId, []);

        const embed = new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle("🚫 Auto Timeout - Spam")
          .addFields(
            { name: "Korisnik", value: `${message.author.tag}`, inline: true },
            { name: "Trajanje", value: formatDuration(durationMs), inline: true },
            { name: "Razlog", value: "Spam poruke", inline: false }
          )
          .setTimestamp();

        await logModeration(
          message.guild,
          embed,
          `spam:${message.author.id}:${Math.floor(now / 5000)}`
        );
        return;
      }
    }

    const stats = getUserStats(message.author.id);
    stats.totalMessages += 1;
    stats.cycleMessages += 1;

    const imageCount = countImageAttachments(message);
    if (imageCount > 0) {
      stats.totalImages += imageCount;
      stats.cycleImages += imageCount;
    }

    saveData();

    await checkAndApplyLevelUp(member);
  } catch (err) {
    console.error("❌ Greška u MessageCreate handleru:", err);
  }
});

// ======================================================
// BUTTON INTERACTIONS
// ======================================================
async function handleButtonInteraction(interaction) {
  if (ROLES[interaction.customId]) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const roleId = ROLES[interaction.customId];
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

      if (!role) {
        return await safeReply(interaction, "❌ Rola nije pronađena.");
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);

      const allRoleIds = Object.values(ROLES);
      const rolesToRemove = allRoleIds.filter(
        (id) => id !== role.id && member.roles.cache.has(id)
      );

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);

        const embed = new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle("➖ Rola uklonjena")
          .setDescription(`Uklonjena ti je rola **${role.name}**.`)
          .setTimestamp();

        return await safeReply(interaction, { embeds: [embed] });
      }

      if (rolesToRemove.length) {
        await member.roles.remove(rolesToRemove);
      }

      await member.roles.add(role);

      const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Rola dodata")
        .setDescription(`Dodata ti je rola **${role.name}**.`)
        .setTimestamp();

      return await safeReply(interaction, { embeds: [embed] });
    } catch (err) {
      console.error("❌ Greška pri role interaction:", err);
      return await safeReply(interaction, "❌ Greška prilikom menjanja role.");
    }
  }

  if (interaction.customId === "open_ticket") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const user = interaction.user;
      const member = await guild.members.fetch(user.id);

      const existingTicket = await findExistingUserTicket(guild, user.id);
      if (existingTicket) {
        return await safeReply(
          interaction,
          `⚠️ Već imaš otvoren ticket: ${existingTicket}`
        );
      }

      const joinDate = member.joinedAt ? formatJoinDate(member.joinedAt) : "Nepoznato";

      const validTicketStaffRoleIds = TICKET_VIEW_ROLE_IDS.filter((roleId) =>
        guild.roles.cache.has(roleId)
      );

      const baseName = sanitizeChannelName(user.username || user.id);
      let ticketName = `ticket-${baseName}`;
      let counter = 1;

      while (guild.channels.cache.some((ch) => ch.name === ticketName)) {
        counter++;
        ticketName = `ticket-${baseName}-${counter}`;
      }

      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks,
          ],
        },
        ...validTicketStaffRoleIds.map((roleId) => ({
          id: roleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageMessages,
          ],
        })),
      ];

      const ticketChannel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites,
      });

      const ticketEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎫 Ticket otvoren")
        .setDescription(
          [
            `Zdravo ${user}, dobrodošao u ticket.`,
            "",
            "Popuni sledeći format:",
            "",
            `**Vaš tag:** ${user.tag}`,
            `**Kad ste join-ali server:** ${joinDate}`,
            "**Razlog otvaranja ticketa:**",
            "Npr: vređanje, pretnja, zahtev za modove, optimizacija za igricu ili kompjuter itd.",
          ].join("\n")
        )
        .setFooter({ text: "Mak0 Community • Ticket sistem" })
        .setTimestamp();

      await safeSend(ticketChannel, {
        content: `${user}`,
        embeds: [ticketEmbed],
        components: [buildCloseTicketButtons()],
      });

      const logEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("📂 Novi Ticket")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Kanal", value: `${ticketChannel}`, inline: true },
          { name: "Join datum", value: joinDate, inline: false }
        )
        .setTimestamp();

      await logModeration(
        guild,
        logEmbed,
        `ticket-open:${user.id}:${ticketChannel.id}`
      );

      await safeReply(interaction, `✅ Ticket napravljen: ${ticketChannel}`);
    } catch (err) {
      console.error("❌ TICKET ERROR:", err);
      return await safeReply(interaction, "❌ Greška pri otvaranju ticketa.");
    }
  }

  if (interaction.customId === "close_ticket") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.channel;
      if (!channel || channel.parentId !== TICKET_CATEGORY_ID) {
        return await safeReply(interaction, "❌ Ovo nije ticket kanal.");
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isTicketOwner = channel.permissionOverwrites.cache.has(interaction.user.id);
      const canModerateTicket = isFullAdmin(member);

      if (!isTicketOwner && !canModerateTicket) {
        return await safeReply(interaction, "❌ Nemaš dozvolu da zatvoriš ovaj ticket.");
      }

      const logEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🔒 Ticket zatvoren")
        .addFields(
          { name: "Kanal", value: `${channel.name}`, inline: true },
          { name: "Zatvorio", value: `${interaction.user.tag}`, inline: true }
        )
        .setTimestamp();

      await logModeration(
        interaction.guild,
        logEmbed,
        `ticket-close:${channel.id}`
      );

      await safeReply(interaction, "✅ Ticket će biti obrisan za 3 sekunde.");

      setTimeout(async () => {
        await channel.delete().catch(() => {});
      }, 3000);
    } catch (err) {
      console.error("❌ Greška pri zatvaranju ticketa:", err);
      return await safeReply(interaction, "❌ Greška pri zatvaranju ticketa.");
    }
  }
}

// ======================================================
// SLASH COMMANDS
// ======================================================
async function handleSlashCommand(interaction) {
  console.log("SLASH START", {
    id: interaction.id,
    command: interaction.commandName,
    user: interaction.user.tag,
    time: new Date().toISOString(),
  });

  await interaction.deferReply().catch(() => null);

  let member;

  try {
    member = await getFreshMember(interaction);
  } catch (err) {
    console.error("❌ Ne mogu da fetchujem člana:", err);
    return await safeReply(interaction, {
      content: "❌ Došlo je do greške pri proveri dozvola.",
      ephemeral: true,
    });
  }

  if (!canUseCommand(member, interaction.commandName)) {
    return await safeReply(interaction, {
      content: "❌ Nemaš dozvolu za ovu komandu.",
      ephemeral: true,
    });
  }

  try {
    if (interaction.commandName === "ban") {
      if (!isFullAdmin(member)) {
        return await safeReply(interaction, {
          content: "❌ Samo Owner, Deputy Owner i Admin Lvl. 3 mogu koristiti ban.",
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser("korisnik", true);
      const reason = interaction.options.getString("razlog") || "Nije naveden razlog";
      const target = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!target) {
        return await safeReply(interaction, {
          content: "❌ Korisnik nije pronađen.",
          ephemeral: true,
        });
      }

      await target.ban({ reason });

      const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🔨 Ban uspešan")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
          { name: "Razlog", value: reason, inline: false }
        )
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      await logBan(interaction.guild, embed, `ban:${user.id}:${interaction.id}`);
      return;
    }

    if (interaction.commandName === "kick") {
      const user = interaction.options.getUser("korisnik", true);
      const reason = interaction.options.getString("razlog") || "Nije naveden razlog";
      const target = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!target) {
        return await safeReply(interaction, {
          content: "❌ Korisnik nije pronađen.",
          ephemeral: true,
        });
      }

      await target.kick(reason);

      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("👢 Kick uspešan")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
          { name: "Razlog", value: reason, inline: false }
        )
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      await logModeration(interaction.guild, embed, `kick:${user.id}:${interaction.id}`);
      return;
    }

    if (interaction.commandName === "timeout") {
      const user = interaction.options.getUser("korisnik", true);
      const minutes = interaction.options.getInteger("minuta", true);
      const reason = interaction.options.getString("razlog") || "Nije naveden razlog";
      const target = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!target) {
        return await safeReply(interaction, {
          content: "❌ Korisnik nije pronađen.",
          ephemeral: true,
        });
      }

      const durationMs = minutes * 60 * 1000;
      await target.timeout(durationMs, reason);

      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("⏳ Timeout uspešan")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Trajanje", value: formatDuration(durationMs), inline: true },
          { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
          { name: "Razlog", value: reason, inline: false }
        )
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      await logModeration(interaction.guild, embed, `timeout:${user.id}:${interaction.id}`);
      return;
    }

    if (interaction.commandName === "untimeout") {
      const user = interaction.options.getUser("korisnik", true);
      const target = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!target) {
        return await safeReply(interaction, {
          content: "❌ Korisnik nije pronađen.",
          ephemeral: true,
        });
      }

      await target.timeout(null);

      const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Timeout uklonjen")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Moderator", value: `${interaction.user.tag}`, inline: true }
        )
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      await logModeration(interaction.guild, embed, `untimeout:${user.id}:${interaction.id}`);
      return;
    }

    if (interaction.commandName === "warn") {
      const user = interaction.options.getUser("korisnik", true);
      const reason = interaction.options.getString("razlog") || "Nije naveden razlog";

      const warnings = getWarnings(user.id);
      warnings.push({
        moderatorId: interaction.user.id,
        reason,
        date: new Date().toISOString(),
      });
      saveData();

      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("⚠️ Warn dodat")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Ukupno warnova", value: `${warnings.length}`, inline: true },
          { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
          { name: "Razlog", value: reason, inline: false }
        )
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      await logModeration(interaction.guild, embed, `warn:${user.id}:${warnings.length}:${interaction.id}`);

      if (warnings.length >= 5) {
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (target) {
          const autoKickKey = `autokick:${interaction.guild.id}:${user.id}`;

          if (!shouldSkipDuplicate(autoKickKey, DEDUPE.AUTO_KICK_MS)) {
            await target.kick("Automatski kick nakon 5 warnova").catch(() => null);

            const autoKickEmbed = new EmbedBuilder()
              .setColor("#ED4245")
              .setTitle("👢 Auto Kick nakon 5 warnova")
              .addFields(
                { name: "Korisnik", value: `${user.tag}`, inline: true },
                { name: "Ukupno warnova", value: `${warnings.length}`, inline: true },
                { name: "Razlog", value: "Dostigao 5 warnova", inline: false }
              )
              .setTimestamp();

            await logModeration(
              interaction.guild,
              autoKickEmbed,
              `autokick-log:${user.id}`
            );
          }
        }
      }
      return;
    }

    if (interaction.commandName === "unwarn") {
      const user = interaction.options.getUser("korisnik", true);
      const index = interaction.options.getInteger("broj", true);

      const warnings = getWarnings(user.id);

      if (!warnings.length) {
        return await safeReply(interaction, {
          content: `⚠️ ${user.tag} nema warnove.`,
          ephemeral: true,
        });
      }

      if (index < 1 || index > warnings.length) {
        return await safeReply(interaction, {
          content: `❌ Broj warna mora biti između 1 i ${warnings.length}.`,
          ephemeral: true,
        });
      }

      const removed = warnings.splice(index - 1, 1)[0];
      saveData();

      const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Warn uklonjen")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Obrisan warn", value: `${index}`, inline: true },
          { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
          { name: "Razlog uklonjenog warna", value: removed.reason, inline: false },
          { name: "Preostalo warnova", value: `${warnings.length}`, inline: false }
        )
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      await logModeration(interaction.guild, embed, `unwarn:${user.id}:${index}:${interaction.id}`);
      return;
    }

    if (interaction.commandName === "warnings") {
      const user = interaction.options.getUser("korisnik", true);
      const warnings = getWarnings(user.id);

      if (!warnings.length) {
        return await safeReply(interaction, {
          content: `⚠️ ${user.tag} nema warnove.`,
          ephemeral: true,
        });
      }

      const description = warnings
        .map((warn, index) => {
          return `**${index + 1}.** ${warn.reason}\nModerator: <@${warn.moderatorId}>\nDatum: ${new Date(warn.date).toLocaleString("sr-RS")}`;
        })
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`📋 Warnovi za ${user.tag}`)
        .setDescription(description.slice(0, 4000))
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], ephemeral: true });

      const logEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("📋 Pregled warnova")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Pogledao", value: `${interaction.user.tag}`, inline: true },
          { name: "Ukupno", value: `${warnings.length}`, inline: true }
        )
        .setTimestamp();

      await logModeration(interaction.guild, logEmbed, `warnings:${user.id}:${interaction.id}`);
      return;
    }

    if (interaction.commandName === "clear") {
      const amount = interaction.options.getInteger("broj", true);

      if (amount < 1 || amount > 100) {
        return await safeReply(interaction, {
          content: "❌ Broj mora biti između 1 i 100.",
          ephemeral: true,
        });
      }

      const deleted = await interaction.channel.bulkDelete(amount, true);

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🧹 Poruke obrisane")
        .setDescription(`Obrisano: **${deleted.size}** poruka.`)
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], ephemeral: true });

      const logEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🧹 Clear log")
        .addFields(
          { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
          { name: "Kanal", value: `${interaction.channel}`, inline: true },
          { name: "Broj", value: `${deleted.size}`, inline: true }
        )
        .setTimestamp();

      await logModeration(
        interaction.guild,
        logEmbed,
        `clear:${interaction.channelId}:${interaction.id}`
      );
      return;
    }

    if (interaction.commandName === "sendlatestvideo") {
      if (!isFullAdmin(member)) {
        return await safeReply(interaction, {
          content: "❌ Samo Owner, Deputy Owner i Admin Lvl. 3 mogu koristiti ovu komandu.",
          ephemeral: true,
        });
      }

      const success = await forceSendLatestVideo(interaction.guild);

      if (!success) {
        return await safeReply(interaction, {
          content: "❌ Nisam uspeo da pošaljem najnoviji video.",
          ephemeral: true,
        });
      }

      return await safeReply(interaction, {
        content: "✅ Najnoviji video je uspešno poslat.",
        ephemeral: true,
      });
    }

    if (interaction.commandName === "userinfo") {
      const user = interaction.options.getUser("korisnik", true);
      const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!targetMember) {
        return await safeReply(interaction, {
          content: "❌ Korisnik nije pronađen na serveru.",
          ephemeral: true,
        });
      }

      const stats = getUserStats(user.id);

      const roleList = targetMember.roles.cache
        .filter((role) => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => role.toString())
        .join(", ");

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🧾 User Info")
        .setThumbnail(user.displayAvatarURL({ forceStatic: false }))
        .addFields(
          { name: "👤 Korisnik", value: `${user.tag}`, inline: true },
          { name: "🆔 ID", value: `${user.id}`, inline: true },
          { name: "📅 Napravio nalog", value: formatJoinDate(user.createdAt), inline: false },
          { name: "📥 Ušao na server", value: formatJoinDate(targetMember.joinedAt), inline: false },
          { name: "💬 Ukupno poruka", value: `${stats.totalMessages || 0}`, inline: true },
          { name: "🖼️ Ukupno slika", value: `${stats.totalImages || 0}`, inline: true },
          { name: "📊 Trenutni ciklus poruka", value: `${stats.cycleMessages || 0}`, inline: true },
          { name: "🖼️ Trenutni ciklus slika", value: `${stats.cycleImages || 0}`, inline: true },
          { name: "🔗 Ušao preko", value: stats.joinedBy || "Nepoznato", inline: true },
          { name: "🏷️ Invite kod", value: stats.joinedByCode || "Nepoznato", inline: true },
          { name: "🎭 Role", value: roleList || "Nema rola", inline: false }
        )
        .setFooter({ text: `Pogledao: ${interaction.user.tag}` })
        .setTimestamp();

      await safeReply(interaction, {
        embeds: [embed],
        ephemeral: true,
      });

      const logEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🧾 UserInfo korišćen")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Pogledao", value: `${interaction.user.tag}`, inline: true }
        )
        .setTimestamp();

      await logModeration(
        interaction.guild,
        logEmbed,
        `userinfo:${user.id}:${interaction.id}`
      );
      return;
    }
  } catch (error) {
    console.error(`❌ Greška u komandi ${interaction.commandName}:`, error);

    return await safeReply(interaction, {
      content: "❌ Došlo je do greške prilikom izvršavanja komande.",
      ephemeral: true,
    });
  }
}

// ======================================================
// INTERACTION ROUTER
// ======================================================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isButton() && !interaction.isChatInputCommand()) return;

    if (!markInteractionProcessed(interaction.id)) {
      console.log(`⚠️ Dupli interaction preskočen: ${interaction.id}`);
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }
  } catch (err) {
    console.error("❌ Greška u InteractionCreate routeru:", err);
  }
});

// ======================================================
// PROCESS ERROR HANDLING
// ======================================================
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

// ======================================================
// LOGIN
// ======================================================
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN nije pronađen u .env fajlu.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);