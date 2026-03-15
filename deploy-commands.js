require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const config = require("./config.json");

const commands = [
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banuj korisnika.")
    .addUserOption((option) =>
      option.setName("korisnik").setDescription("Korisnik za ban").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("razlog").setDescription("Razlog bana").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kickuj korisnika.")
    .addUserOption((option) =>
      option.setName("korisnik").setDescription("Korisnik za kick").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("razlog").setDescription("Razlog kicka").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Stavi korisnika na timeout.")
    .addUserOption((option) =>
      option.setName("korisnik").setDescription("Korisnik za timeout").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("minuta")
        .setDescription("Koliko minuta traje timeout")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("razlog").setDescription("Razlog timeouta").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Skini timeout sa korisnika.")
    .addUserOption((option) =>
      option
        .setName("korisnik")
        .setDescription("Korisnik kome se skida timeout")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Dodaj warn korisniku.")
    .addUserOption((option) =>
      option.setName("korisnik").setDescription("Korisnik za warn").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("razlog").setDescription("Razlog warna").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Ukloni warn korisniku po broju.")
    .addUserOption((option) =>
      option.setName("korisnik").setDescription("Korisnik").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("broj")
        .setDescription("Broj warna koji brišeš")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Pogledaj warnove korisnika.")
    .addUserOption((option) =>
      option.setName("korisnik").setDescription("Korisnik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Obriši više poruka iz kanala.")
    .addIntegerOption((option) =>
      option
        .setName("broj")
        .setDescription("Broj poruka za brisanje")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("sendlatestvideo")
    .setDescription("Pošalji najnoviji YouTube video ručno."),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Prikaži detaljne informacije o korisniku. Samo za staff.")
    .addUserOption((option) =>
      option.setName("korisnik").setDescription("Korisnik").setRequired(true)
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.DISCORD_TOKEN) {
      throw new Error("DISCORD_TOKEN nije pronađen u .env fajlu.");
    }

    if (!config.clientId) {
      throw new Error("clientId nije pronađen u config.json.");
    }

    if (!config.guildId) {
      throw new Error("guildId nije pronađen u config.json.");
    }

    console.log("🔄 Registrujem slash komande...");

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );

    console.log("✅ Slash komande uspešno registrovane.");
  } catch (error) {
    console.error("❌ Greška pri deploy komandi:", error);
  }
})();