require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const Parser = require("rss-parser");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const parser = new Parser();

// =========================
// KONFIG
// =========================
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

const ROLES = {
  srbija: "1445551513455034459",
  bosna: "1445551990980612096",
  hrvatska: "1445552126867800145",
  crnagora: "1445552267716460604",
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

const WARNS = new Map(); // userId -> [{ moderatorId, reason, date }]
const messageTracker = new Map();

const ANTI_SPAM = {
  INTERVAL_MS: 7000,
  MAX_MESSAGES: 5,
  TIMEOUT_MINUTES: 10,
};

const ANTI_CAPS = {
  MIN_LENGTH: 12,
  UPPERCASE_RATIO: 0.7,
  TIMEOUT_MINUTES: 5,
};

let lastYoutubeVideoId = null;
let youtubeInterval = null;

// =========================
// POMOCNE FUNKCIJE
// =========================
function hasAnyRole(member, roleIds) {
  return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

function isFullAdmin(member) {
  return hasAnyRole(member, FULL_ADMIN_ROLE_IDS);
}

function isLimitedAdmin(member) {
  return hasAnyRole(member, LIMITED_ADMIN_ROLE_IDS);
}

function canUseCommand(member, commandName) {
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
  if (!WARNS.has(userId)) WARNS.set(userId, []);
  return WARNS.get(userId);
}

function isAllCapsMessage(content) {
  const letters = content.replace(/[^a-zA-ZšđčćžŠĐČĆŽ]/g, "");
  if (letters.length < ANTI_CAPS.MIN_LENGTH) return false;

  const upper = letters.split("").filter((c) => c === c.toUpperCase()).length;
  const ratio = upper / letters.length;

  return ratio >= ANTI_CAPS.UPPERCASE_RATIO;
}

async function logToChannel(guild, channelId, embed) {
  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function logModeration(guild, embed) {
  await logToChannel(guild, MOD_LOG_CHANNEL_ID, embed);
}

async function logBan(guild, embed) {
  await logToChannel(guild, BAN_LOG_CHANNEL_ID, embed);
}

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
        `Dobro dosao/la u Mak0 Community ${member} lepo se provedi.`,
        "",
        "🎭 U role request kanalu možeš dobiti svoju country rolu.",
        "📌 Samo klikni na dugme i izaberi državu.",
      ].join("\n")
    )
    .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
    .setFooter({ text: "Mak0 Community" })
    .setTimestamp();
}

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

function buildYouTubeEmbed(video) {
  const videoId = extractVideoId(video);
  const thumbnail =
    video?.enclosure?.url ||
    video?.thumbnail ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

  const embed = new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("📷 Novi video je objavljen!")
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

async function findExistingUserTicket(guild, userId) {
  const channels = guild.channels.cache.filter(
    (ch) =>
      ch.parentId === TICKET_CATEGORY_ID &&
      ch.type === ChannelType.GuildText &&
      ch.permissionOverwrites.cache.has(userId)
  );

  return channels.first() || null;
}

async function getFreshMember(interaction) {
  return await interaction.guild.members.fetch(interaction.user.id);
}

// =========================
// PANELI
// =========================
async function ensureRolePanel(guild) {
  const roleChannel = guild.channels.cache.get(ROLE_CHANNEL_ID);
  if (!roleChannel || roleChannel.type !== ChannelType.GuildText) {
    console.log("Role channel nije pronađen.");
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
      console.log("Role panel već postoji.");
      return;
    }

    await roleChannel.send({
      embeds: [buildRoleEmbed()],
      components: [buildRoleButtons()],
    });

    console.log("Role panel poslat.");
  } catch (err) {
    console.error("Greška pri role panelu:", err);
  }
}

async function ensureTicketPanel(guild) {
  const panelChannel = guild.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
  if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
    console.log("Ticket panel kanal nije pronađen.");
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
      console.log("Ticket panel već postoji.");
      return;
    }

    await panelChannel.send({
      embeds: [buildTicketPanelEmbed()],
      components: [buildTicketPanelButtons()],
    });

    console.log("Ticket panel poslat.");
  } catch (err) {
    console.error("Greška pri ticket panelu:", err);
  }
}

// =========================
// YOUTUBE
// =========================
async function getLatestYouTubeVideo() {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
  console.log("[YT] Proveravam feed:", feedUrl);

  const feed = await parser.parseURL(feedUrl);

  if (!feed || !feed.items || !feed.items.length) {
    console.log("[YT] Feed nema iteme.");
    return null;
  }

  const latest = feed.items[0];
  const latestVideoId = extractVideoId(latest);

  console.log("[YT] Najnoviji video:", {
    title: latest.title,
    link: latest.link,
    id: latestVideoId,
    isoDate: latest.isoDate,
  });

  if (!latestVideoId) {
    console.log("[YT] Nije pronađen video ID.");
    return null;
  }

  return {
    video: latest,
    videoId: latestVideoId,
  };
}

async function sendYouTubeNotification(guild, video) {
  const channel = guild.channels.cache.get(YOUTUBE_NOTIFICATION_CHANNEL_ID);

  if (!channel || channel.type !== ChannelType.GuildText) {
    console.log("[YT] Discord kanal za obaveštenja nije pronađen.");
    return;
  }

  const embed = buildYouTubeEmbed(video);

  await channel.send({
    content: "🚨 **Novi Mak0 video!**",
    embeds: [embed],
  });

  console.log("[YT] Poslato obaveštenje za:", video.title);
}

async function initYouTubeNotifier() {
  try {
    const latest = await getLatestYouTubeVideo();
    if (!latest) return;

    lastYoutubeVideoId = latest.videoId;
    console.log("[YT] Inicijalizovan poslednji video ID:", lastYoutubeVideoId);
  } catch (err) {
    console.error("[YT] Greška pri inicijalizaciji:", err);
  }
}

async function checkYouTubeUploads(guild) {
  try {
    const latest = await getLatestYouTubeVideo();
    if (!latest) return;

    if (!lastYoutubeVideoId) {
      lastYoutubeVideoId = latest.videoId;
      console.log("[YT] lastYoutubeVideoId nije bio postavljen, sad jeste:", lastYoutubeVideoId);
      return;
    }

    if (latest.videoId === lastYoutubeVideoId) {
      console.log("[YT] Nema novog videa.");
      return;
    }

    lastYoutubeVideoId = latest.videoId;
    await sendYouTubeNotification(guild, latest.video);
  } catch (err) {
    console.error("[YT] Greška u proveri YouTube videa:", err);
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
    console.error("[YT] Greška pri force slanju:", err);
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

// =========================
// READY
// =========================
client.once(Events.ClientReady, async () => {
  console.log(`${client.user.tag} je online`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.log("Guild nije pronađen.");
    return;
  }

  await ensureRolePanel(guild);
  await ensureTicketPanel(guild);
  startYouTubeNotifier(guild);

  // TEST ONLY:
  // await forceSendLatestVideo(guild);
});

// =========================
// WELCOME
// =========================
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!welcomeChannel || welcomeChannel.type !== ChannelType.GuildText) return;

    await welcomeChannel.send({
      embeds: [buildWelcomeEmbed(member)],
    });
  } catch (err) {
    console.error("Greška u welcome sistemu:", err);
  }
});

// =========================
// ANTI SPAM / ALL CAPS
// =========================
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;

  const member = message.member;
  if (!member) return;
  if (isFullAdmin(member) || isLimitedAdmin(member)) return;

  try {
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

      await logModeration(message.guild, embed);
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

      await logModeration(message.guild, embed);
    }
  } catch (err) {
    console.error("Greška u anti spam sistemu:", err);
  }
});

// =========================
// BUTTON INTERACTIONS
// =========================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (ROLES[interaction.customId]) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const roleId = ROLES[interaction.customId];
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

      if (!role) {
        return interaction.editReply("Rola nije pronađena.");
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

        return interaction.editReply({ embeds: [embed] });
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

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Greška pri role interaction:", err);
      return interaction.editReply("Greška prilikom menjanja role.").catch(() => {});
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
        return interaction.editReply(`Već imaš otvoren ticket: ${existingTicket}`);
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
        .setTitle("🎫 Ticket Otvoren")
        .setDescription(
          [
            `Zdravo ${user}, dobrodošao u ticket.`,
            "",
            "Popuni sledeći format:",
            "",
            `**Vaš tag:** ${user.tag}`,
            `**Kad ste join-ali server:** ${joinDate}`,
            "**Razlog otvaranja ticketa:**",
            "Npr: Vređanje, pretnja, zahtev za modove za neku igricu, optimizacija za igricu ili kompjuter, itd.",
          ].join("\n")
        )
        .setFooter({ text: "Mak0 Community • Ticket sistem" })
        .setTimestamp();

      await ticketChannel.send({
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

      await logModeration(guild, logEmbed);
      await interaction.editReply(`✅ Ticket napravljen: ${ticketChannel}`);
    } catch (err) {
      console.error("TICKET ERROR:", err);
      return interaction.editReply("Greška pri otvaranju ticketa.").catch(() => {});
    }
  }

  if (interaction.customId === "close_ticket") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.channel;
      if (!channel || channel.parentId !== TICKET_CATEGORY_ID) {
        return interaction.editReply("Ovo nije ticket kanal.");
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isTicketOwner = channel.permissionOverwrites.cache.has(interaction.user.id);
      const canModerateTicket = isFullAdmin(member);

      if (!isTicketOwner && !canModerateTicket) {
        return interaction.editReply("Nemaš dozvolu da zatvoriš ovaj ticket.");
      }

      const logEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🔒 Ticket zatvoren")
        .addFields(
          { name: "Kanal", value: `${channel.name}`, inline: true },
          { name: "Zatvorio", value: `${interaction.user.tag}`, inline: true }
        )
        .setTimestamp();

      await logModeration(interaction.guild, logEmbed);
      await interaction.editReply("Ticket će biti obrisan za 3 sekunde.");

      setTimeout(async () => {
        await channel.delete().catch(() => {});
      }, 3000);
    } catch (err) {
      console.error("Greška pri zatvaranju ticketa:", err);
      return interaction.editReply("Greška pri zatvaranju ticketa.").catch(() => {});
    }
  }
});

// =========================
// SLASH COMMANDS
// =========================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const member = await getFreshMember(interaction);

  if (!canUseCommand(member, interaction.commandName)) {
    return interaction.reply({
      content: "Nemaš dozvolu za ovu komandu.",
      ephemeral: true,
    });
  }

  try {
    if (interaction.commandName === "ban") {
      if (!isFullAdmin(member)) {
        return interaction.reply({
          content: "Samo Owner, Deputy Owner i Admin Lvl. 3 mogu koristiti ban.",
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser("korisnik", true);
      const reason = interaction.options.getString("razlog") || "Nije naveden razlog";

      const target = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!target) {
        return interaction.reply({
          content: "Korisnik nije pronađen.",
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

      await interaction.reply({ embeds: [embed] });
      await logBan(interaction.guild, embed);
      return;
    }

    if (interaction.commandName === "kick") {
      const user = interaction.options.getUser("korisnik", true);
      const reason = interaction.options.getString("razlog") || "Nije naveden razlog";

      const target = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!target) {
        return interaction.reply({
          content: "Korisnik nije pronađen.",
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

      await interaction.reply({ embeds: [embed] });
      await logModeration(interaction.guild, embed);
      return;
    }

    if (interaction.commandName === "timeout") {
      const user = interaction.options.getUser("korisnik", true);
      const minutes = interaction.options.getInteger("minuta", true);
      const reason = interaction.options.getString("razlog") || "Nije naveden razlog";

      const target = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!target) {
        return interaction.reply({
          content: "Korisnik nije pronađen.",
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

      await interaction.reply({ embeds: [embed] });
      await logModeration(interaction.guild, embed);
      return;
    }

    if (interaction.commandName === "untimeout") {
      const user = interaction.options.getUser("korisnik", true);
      const target = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!target) {
        return interaction.reply({
          content: "Korisnik nije pronađen.",
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

      await interaction.reply({ embeds: [embed] });
      await logModeration(interaction.guild, embed);
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

      await interaction.reply({ embeds: [embed] });
      await logModeration(interaction.guild, embed);

      if (warnings.length >= 5) {
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (target) {
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

          await logModeration(interaction.guild, autoKickEmbed);
        }
      }
      return;
    }

    if (interaction.commandName === "unwarn") {
      const user = interaction.options.getUser("korisnik", true);
      const index = interaction.options.getInteger("broj", true);

      const warnings = getWarnings(user.id);

      if (!warnings.length) {
        return interaction.reply({
          content: `${user.tag} nema warnove.`,
          ephemeral: true,
        });
      }

      if (index < 1 || index > warnings.length) {
        return interaction.reply({
          content: `Broj warna mora biti između 1 i ${warnings.length}.`,
          ephemeral: true,
        });
      }

      const removed = warnings.splice(index - 1, 1)[0];

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

      await interaction.reply({ embeds: [embed], ephemeral: true });
      await logModeration(interaction.guild, embed);
      return;
    }

    if (interaction.commandName === "warnings") {
      const user = interaction.options.getUser("korisnik", true);
      const warnings = getWarnings(user.id);

      if (!warnings.length) {
        return interaction.reply({
          content: `${user.tag} nema warnove.`,
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

      await interaction.reply({ embeds: [embed], ephemeral: true });

      const logEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("📋 Pregled warnova")
        .addFields(
          { name: "Korisnik", value: `${user.tag}`, inline: true },
          { name: "Pogledao", value: `${interaction.user.tag}`, inline: true },
          { name: "Ukupno", value: `${warnings.length}`, inline: true }
        )
        .setTimestamp();

      await logModeration(interaction.guild, logEmbed);
      return;
    }

    if (interaction.commandName === "clear") {
      const amount = interaction.options.getInteger("broj", true);

      if (amount < 1 || amount > 100) {
        return interaction.reply({
          content: "Broj mora biti između 1 i 100.",
          ephemeral: true,
        });
      }

      const deleted = await interaction.channel.bulkDelete(amount, true);

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🧹 Poruke obrisane")
        .setDescription(`Obrisano: **${deleted.size}** poruka.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      const logEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🧹 Clear log")
        .addFields(
          { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
          { name: "Kanal", value: `${interaction.channel}`, inline: true },
          { name: "Broj", value: `${deleted.size}`, inline: true }
        )
        .setTimestamp();

      await logModeration(interaction.guild, logEmbed);
      return;
    }

    if (interaction.commandName === "sendlatestvideo") {
      if (!isFullAdmin(member)) {
        return interaction.reply({
          content: "Samo Owner, Deputy Owner i Admin Lvl. 3 mogu koristiti ovu komandu.",
          ephemeral: true,
        });
      }

      const success = await forceSendLatestVideo(interaction.guild);

      if (!success) {
        return interaction.reply({
          content: "Nisam uspeo da pošaljem najnoviji video.",
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: "Najnoviji video je uspešno poslat.",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error(`Greška u komandi ${interaction.commandName}:`, error);

    const response = {
      content: error.message || "Došlo je do greške.",
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(response).catch(() => {});
    }

    return interaction.reply(response).catch(() => {});
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN nije pronađen u .env fajlu.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);