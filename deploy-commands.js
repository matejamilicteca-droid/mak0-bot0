const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const config = require("./config.json");

const commands = [
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banuj korisnika")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName("korisnik")
        .setDescription("Koga banuješ")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("razlog")
        .setDescription("Razlog bana")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kickuj korisnika")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName("korisnik")
        .setDescription("Koga kickuješ")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("razlog")
        .setDescription("Razlog kicka")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Stavi korisnika u timeout")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("korisnik")
        .setDescription("Korisnik")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("minuta")
        .setDescription("Trajanje u minutama")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption((option) =>
      option
        .setName("razlog")
        .setDescription("Razlog timeouta")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Skini timeout korisniku")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("korisnik")
        .setDescription("Korisnik")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Dodaj warn korisniku")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("korisnik")
        .setDescription("Korisnik")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("razlog")
        .setDescription("Razlog warna")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Ukloni warn korisniku")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("korisnik")
        .setDescription("Korisnik")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("broj")
        .setDescription("Broj warna koji brišeš")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Prikaži warnove korisnika")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("korisnik")
        .setDescription("Korisnik")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Obriši poruke")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("broj")
        .setDescription("Broj poruka za brisanje")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    console.log("Deploy slash komandi...");

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );

    console.log("Slash komande uspešno deployovane.");
  } catch (error) {
    console.error("Greška pri deploy-u komandi:", error);
  }
})();