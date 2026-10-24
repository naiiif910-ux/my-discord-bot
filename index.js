const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// 1. البيانات الأساسية
const TOKEN = '';
const CLIENT_ID = '1562488534701445231';

// 2. آيدي رتبة مسؤول الإدارة (لمسؤول الجرد)
const ADMIN_MANAGER_ROLE_ID = '1552841090317422653';

// 3. آيديهات رتب الشروط والأحكام والمنع
const VERIFIED_ROLE_ID = '1552841361500283011';
const UNVERIFIED_ROLE_ID = '1552841367208599615';
const BLOCKED_ROLE_ID = '1552841368471207946'; // ⬅️ استبدل هذا بالآيدي الحقيقي לרتبة المنع

// 4. آيديهات رتب القطاعات الأمنية
const SECTOR_ROLES = {
    'دوريات': '1552841240842604544',
    'مرور': '1552841241631269049',
    'طرق': '1552841242851942540',
    'شرطة': '1552841243749261353'
};

// 5. آيدي رتبة جندي (سهم) الثابتة للتفعيل
const SOLDIER_ROLE_ID = '1552841333108908059';

// 6. عداد رتبة جندي (سهم) يبدأ من 54 ويزيد تلقائياً
let soldierCounter = 54;

// 7. سجل إحصائيات الإداريين
const adminStats = {};

// 8. تسجيل أوامر السلاش (/تفعيل و /جرد)
const commands = [
    new SlashCommandBuilder()
        .setName('تفعيل')
        .setDescription('تفعيل عسكري تلقائي برتبة جندي وتحديد القطاع والاسم')
        .addUserOption(option => 
            option.setName('المستخدم')
                .setDescription('اختر العضو المراد تفعيله')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('القطاع')
                .setDescription('اختر القطاع الأمني')
                .setRequired(true)
                .addChoices(
                    { name: 'الدوريات الأمنية', value: 'دوريات' },
                    { name: 'المرور', value: 'مرور' },
                    { name: 'أمن الطرق', value: 'طرق' },
                    { name: 'الشرطة', value: 'شرطة' }
                ))
        .addStringOption(option =>
            option.setName('الاسم')
                .setDescription('الاسم الشخصي للعضو')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('جرد')
        .setDescription('عرض جرد وإحصائيات التفعيل لجميع الإداريين')
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('✅ تم تسجيل الأوامر بنجاح!');
    } catch (error) {
        console.error('❌ خطأ في تسجيل أوامر السلاش:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'تفعيل') {
        // تأجيل الرد الفوري لمنع تعليق الأمر
        await interaction.deferReply({ ephemeral: false });

        const targetMember = interaction.options.getMember('المستخدم');
        const sectorKey = interaction.options.getString('القطاع');
        const name = interaction.options.getString('الاسم');
        const admin = interaction.member;

        if (!targetMember) {
            return interaction.editReply({ content: '❌ لم يتم العثور على هذا العضو في السيرفر.' });
        }

        // 🛑 فحص رتبة المنع من التفعيل
        if (BLOCKED_ROLE_ID && targetMember.roles.cache.has(BLOCKED_ROLE_ID)) {
            return interaction.editReply({
                content: `🚫 **عذراً، هذا العضو (${targetMember}) يحمل رتبة (ممنوع من التفعيل) ولا يمكن تفعيله أبداً!**`
            });
        }

        try {
            const sectorNames = {
                'دوريات': 'الدوريات الأمنية',
                'مرور': 'المرور',
                'طرق': 'أمن الطرق',
                'شرطة': 'الشرطة'
            };

            const fieldCode = `سهم-${soldierCounter}`;
            const newNickname = `${name} | ${fieldCode}`;

            // تغيير الاسم
            await targetMember.setNickname(newNickname);

            // إدارة الرتب
            if (VERIFIED_ROLE_ID) await targetMember.roles.add(VERIFIED_ROLE_ID).catch(() => {});
            if (UNVERIFIED_ROLE_ID) await targetMember.roles.remove(UNVERIFIED_ROLE_ID).catch(() => {});

            const sectorRoleId = SECTOR_ROLES[sectorKey];
            if (sectorRoleId) await targetMember.roles.add(sectorRoleId).catch(() => {});

            if (SOLDIER_ROLE_ID) await targetMember.roles.add(SOLDIER_ROLE_ID).catch(() => {});

            // تحديث الإحصائيات
            const adminId = admin.id;
            const adminName = admin.displayName;

            if (!adminStats[adminId]) {
                adminStats[adminId] = { name: adminName, count: 0 };
            }
            adminStats[adminId].count += 1;
            adminStats[adminId].name = adminName;

            await interaction.editReply({
                content: `✅ **تم تفعيل العضو جندي بنجاح!**\n` +
                         `👤 **العضو:** ${targetMember}\n` +
                         `🏛️ **القطاع:** ${sectorNames[sectorKey]}\n` +
                         `🏷️ **الاسم الميداني:** \`${newNickname}\`\n` +
                         `🔢 **الكود الميداني:** \`${fieldCode}\`\n\n` +
                         `👮‍♂️ **المُفعل:** ${adminName} - ${adminStats[adminId].count}`
            });

            // زيادة العداد
            soldierCounter++;

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: '❌ حدث خطأ! تأكد أن رتبة البوت أعلى من العضو ولديه صلاحية تعديل الأسماء.'
            });
        }
    }

    if (interaction.commandName === 'جرد') {
        const member = interaction.member;
        const isManager = member.roles.cache.has(ADMIN_MANAGER_ROLE_ID);

        if (!isManager) {
            return interaction.reply({
                content: '🛑 **عذراً! هذا الأمر مخصص لمسؤول الإدارة فقط.**',
                ephemeral: true
            });
        }

        const statsKeys = Object.keys(adminStats);
        if (statsKeys.length === 0) {
            return interaction.reply({ content: '📊 **لا يوجد أي تفعيلات مسجلة حتى الآن.**', ephemeral: true });
        }

        let report = '📊 **تقرير جرد تفعيلات الإدارة:**\n\n';
        statsKeys.forEach((id) => {
            const admin = adminStats[id];
            report += `• **${admin.name}** - ${admin.count}\n`;
        });

        await interaction.reply({ content: report });
    }
});

client.login(TOKEN);