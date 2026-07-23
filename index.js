import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  Colors,
  ChannelType,
} from "discord.js";
import { logger } from "../lib/logger.js";
import {
  addPartnership,
  getLeaderboard,
  getPartnerships,
  setPartnershipChannel,
  getPartnershipChannelId,
  setPointsLogChannel,
  getPointsLogChannelId,
  setPartnershipsLogChannel,
  getPartnershipsLogChannelId,
  setMentionRole,
  getMentionRoleId,
} from "./data.js";

const PARTNERSHIP_BUTTON_ID = "partnership_apply";
const PARTNERSHIP_MODAL_ID = "partnership_modal";

const commands = [
  new SlashCommandBuilder()
    .setName("setup-partnership")
    .setDescription("إعداد زر الشراكة في هذه القناة — للطاقم فقط"),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("عرض لوحة نقاط الشراكات"),
  new SlashCommandBuilder()
    .setName("partnerships")
    .setDescription("عرض آخر الشراكات المسجلة"),
  new SlashCommandBuilder()
    .setName("set-channel")
    .setDescription("تحديد روم إرسال الشراكات الجديدة")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("اختر الروم")
        .addChannelTypes(ChannelType.GuildText).setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("set-points-log")
    .setDescription("تحديد روم لوق النقاط")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("اختر الروم")
        .addChannelTypes(ChannelType.GuildText).setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("set-partnerships-log")
    .setDescription("تحديد روم لوق الشراكات المُرسَلة")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("اختر الروم")
        .addChannelTypes(ChannelType.GuildText).setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("set-mention-role")
    .setDescription("تحديد الرتبة التي تُذكر مع كل رسالة شراكة")
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("اختر الرتبة").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("عرض جميع أوامر البوت"),
].map((cmd) => cmd.toJSON());

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_TOKEN not set — Discord bot will not start");
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once("ready", async (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot ready");
    const rest = new REST({ version: "10" }).setToken(token);
    try {
      await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
      logger.info("Slash commands registered globally");
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {

        if (interaction.commandName === "setup-partnership") {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(PARTNERSHIP_BUTTON_ID)
              .setLabel("📋 تقديم شراكة")
              .setStyle(ButtonStyle.Primary)
          );
          const embed = new EmbedBuilder()
            .setTitle("🤝 نظام الشراكات")
            .setDescription(
              "اضغط على الزر أدناه لتقديم شراكة جديدة.\n" +
              "سيتم تسجيل الشراكة وإضافة نقطة لحسابك تلقائياً."
            )
            .setColor(Colors.Blue)
            .setFooter({ text: "نظام شراكات البوت" });
          await interaction.reply({ embeds: [embed], components: [row] });
        }

        else if (interaction.commandName === "leaderboard") {
          const lb = getLeaderboard();
          if (lb.length === 0) {
            await interaction.reply({ content: "❌ لا توجد شراكات مسجلة بعد.", ephemeral: true });
            return;
          }
          const medals = ["🥇", "🥈", "🥉"];
          const rows = lb.map((entry, i) => {
            const medal = medals[i] ?? `**${i + 1}.**`;
            return `${medal} <@${entry.userId}> — **${entry.count}** نقطة`;
          });
          const embed = new EmbedBuilder()
            .setTitle("🏆 لوحة نقاط الشراكات")
            .setDescription(rows.join("\n"))
            .setColor(Colors.Gold).setTimestamp();
          await interaction.reply({ embeds: [embed] });
        }

        else if (interaction.commandName === "partnerships") {
          const list = getPartnerships().slice(0, 10);
          if (list.length === 0) {
            await interaction.reply({ content: "❌ لا توجد شراكات مسجلة بعد.", ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle("📋 آخر الشراكات").setColor(Colors.Green).setTimestamp();
          for (const [i, p] of list.entries()) {
            embed.addFields({
              name: `${i + 1}. ${p.serverName}`,
              value: [`🔗 ${p.serverLink}`, `👥 ${p.memberCount} عضو`,
                `👤 <@${p.staffId}>`, `📅 <t:${Math.floor(p.timestamp / 1000)}:R>`].join("\n"),
              inline: false,
            });
          }
          await interaction.reply({ embeds: [embed] });
        }

        else if (interaction.commandName === "set-channel") {
          const channel = interaction.options.getChannel("channel", true);
          setPartnershipChannel(channel.id);
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle("✅ تم تحديد روم الشراكات")
              .setDescription(`سيتم إرسال الشراكات الجديدة إلى <#${channel.id}>`)
              .setColor(Colors.Green).setTimestamp()],
            ephemeral: true,
          });
        }

        else if (interaction.commandName === "set-points-log") {
          const channel = interaction.options.getChannel("channel", true);
          setPointsLogChannel(channel.id);
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle("✅ تم تحديد روم لوق النقاط")
              .setDescription(`سيتم تسجيل النقاط في <#${channel.id}>`)
              .setColor(Colors.Green).setTimestamp()],
            ephemeral: true,
          });
        }

        else if (interaction.commandName === "set-partnerships-log") {
          const channel = interaction.options.getChannel("channel", true);
          setPartnershipsLogChannel(channel.id);
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle("✅ تم تحديد روم لوق الشراكات")
              .setDescription(`سيتم تسجيل الشراكات المُرسَلة في <#${channel.id}>`)
              .setColor(Colors.Green).setTimestamp()],
            ephemeral: true,
          });
        }

        else if (interaction.commandName === "set-mention-role") {
          const role = interaction.options.getRole("role", true);
          setMentionRole(role.id);
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle("✅ تم تحديد الرتبة")
              .setDescription(`سيتم ذكر <@&${role.id}> مع كل رسالة شراكة`)
              .setColor(Colors.Green).setTimestamp()],
            ephemeral: true,
          });
        }

        else if (interaction.commandName === "help") {
          const embed = new EmbedBuilder()
            .setTitle("📖 أوامر البوت").setColor(Colors.Blurple)
            .addFields(
              { name: "/setup-partnership", value: "إعداد زر الشراكة في القناة الحالية", inline: false },
              { name: "/partnerships", value: "عرض آخر 10 شراكات مسجلة", inline: false },
              { name: "/leaderboard", value: "عرض لوحة نقاط الطاقم", inline: false },
              { name: "/set-channel #الروم", value: "تحديد روم إرسال الشراكات الجديدة", inline: false },
              { name: "/set-points-log #الروم", value: "تحديد روم لوق النقاط", inline: false },
              { name: "/set-partnerships-log #الروم", value: "تحديد روم لوق الشراكات المُرسَلة", inline: false },
              { name: "/set-mention-role @الرتبة", value: "تحديد الرتبة التي تُذكر مع كل رسالة شراكة", inline: false },
              { name: "/help", value: "عرض جميع أوامر البوت", inline: false },
            )
            .setFooter({ text: "نظام شراكات البوت" }).setTimestamp();
          await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      else if (interaction.isButton() && interaction.customId === PARTNERSHIP_BUTTON_ID) {
        const modal = new ModalBuilder()
          .setCustomId(PARTNERSHIP_MODAL_ID).setTitle("📋 نموذج الشراكة");
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("server_name").setLabel("اسم السيرفر")
              .setStyle(TextInputStyle.Short).setPlaceholder("مثال: سيرفر النجوم").setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("server_link").setLabel("رابط السيرفر")
              .setStyle(TextInputStyle.Short).setPlaceholder("مثال: https://discord.gg/xxxxx").setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("member_count").setLabel("عدد الأعضاء")
              .setStyle(TextInputStyle.Short).setPlaceholder("مثال: 500").setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("server_template").setLabel("نموذج السيرفر")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("اكتب النموذج الذي سيُرسل للسيرفر الشريك...").setRequired(true)
          ),
        );
        await interaction.showModal(modal);
      }

      else if (interaction.isModalSubmit() && interaction.customId === PARTNERSHIP_MODAL_ID) {
        const stripMentions = (text: string) =>
          text.replace(/@everyone/gi, "").replace(/@here/gi, "")
            .replace(/<@[!&]?\d+>/g, "").trim();

        const serverName     = stripMentions(interaction.fields.getTextInputValue("server_name"));
        const serverLink     = stripMentions(interaction.fields.getTextInputValue("server_link"));
        const memberCount    = stripMentions(interaction.fields.getTextInputValue("member_count"));
        const serverTemplate = stripMentions(interaction.fields.getTextInputValue("server_template"));

        addPartnership(interaction.user.id, interaction.user.username,
          serverName, serverLink, memberCount, serverTemplate);

        const lb = getLeaderboard();
        const userPoints = lb.find((e) => e.userId === interaction.user.id)?.count ?? 1;
        const guild = interaction.guild;

        if (guild) {
          const savedRoleId = getMentionRoleId();
          const mentionPrefix = savedRoleId ? `<@&${savedRoleId}>\n` : "";

          // 1. روم الشراكات — النموذج كرسالة عادية
          const partnerChannelId = getPartnershipChannelId();
          if (partnerChannelId) {
            const partnerChannel = guild.channels.cache.get(partnerChannelId);
            if (partnerChannel?.isTextBased())
              await partnerChannel.send({ content: `${mentionPrefix}${serverTemplate}` });
          }

          // 2. لوق الشراكات
          const partnershipsLogId = getPartnershipsLogChannelId();
          if (partnershipsLogId) {
            const logCh = guild.channels.cache.get(partnershipsLogId);
            if (logCh?.isTextBased()) {
              await logCh.send({
                embeds: [new EmbedBuilder().setTitle("📋 لوق شراكة جديدة")
                  .addFields(
                    { name: "🏷️ السيرفر",    value: serverName,                  inline: true  },
                    { name: "👥 الأعضاء",    value: `${memberCount} عضو`,        inline: true  },
                    { name: "🔗 الرابط",     value: serverLink,                  inline: false },
                    { name: "👤 المسؤول",    value: `<@${interaction.user.id}>`, inline: true  },
                    { name: "⭐ نقاطه الآن", value: `${userPoints} نقطة`,        inline: true  },
                    { name: "📝 النموذج",    value: serverTemplate,              inline: false },
                  )
                  .setColor(Colors.Fuchsia)
                  .setFooter({ text: `ID: ${interaction.user.id}` }).setTimestamp()],
              });
            }
          }

          // 3. لوق النقاط
          const pointsLogId = getPointsLogChannelId();
          if (pointsLogId) {
            const pointsCh = guild.channels.cache.get(pointsLogId);
            if (pointsCh?.isTextBased()) {
              await pointsCh.send({
                embeds: [new EmbedBuilder().setTitle("⭐ نقطة جديدة")
                  .setDescription(
                    `<@${interaction.user.id}> سجّل شراكة مع **${serverName}**\n` +
                    `رصيده الآن: **${userPoints}** نقطة`
                  )
                  .setColor(Colors.Yellow)
                  .setFooter({ text: `ID: ${interaction.user.id}` }).setTimestamp()],
              });
            }
          }
        }

        // تأكيد خاص للعضو
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle("✅ تم تسجيل الشراكة بنجاح")
            .addFields(
              { name: "🏷️ اسم السيرفر",  value: serverName,           inline: true  },
              { name: "👥 عدد الأعضاء",  value: `${memberCount} عضو`, inline: true  },
              { name: "🔗 رابط السيرفر", value: serverLink,           inline: false },
              { name: "⭐ نقاطك الحالية", value: `${userPoints} نقطة`, inline: true  },
            )
            .setColor(Colors.Green).setTimestamp()],
          ephemeral: true,
        });
      }
    } catch (err) {
      logger.error({ err }, "Error handling interaction");
      if (interaction.isRepliable() && !interaction.replied)
        await interaction.reply({ content: "❌ حدث خطأ، حاول مرة أخرى.", ephemeral: true }).catch(() => null);
    }
  });

  await client.login(token);
}