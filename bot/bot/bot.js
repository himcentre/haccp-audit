import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new Telegraf(BOT_TOKEN);

// Хранилище состояний пользователей
const userStates = new Map();

// Типы форм
const FORM_TYPES = {
  AUDIT: 'audit',
  CHECKLIST: 'checklist'
};

// Шаги для формы аудита
const AUDIT_STEPS = {
  WAITING_FOR_NAME: 'waiting_for_name',
  WAITING_FOR_ORGANIZATION: 'waiting_for_organization',
  WAITING_FOR_PHONE: 'waiting_for_phone'
};

// Шаги для формы чек-листа
const CHECKLIST_STEPS = {
  WAITING_FOR_START: 'waiting_for_start',
  WAITING_FOR_COMPANY: 'waiting_for_company',
  WAITING_FOR_FORMAT: 'waiting_for_format',
  WAITING_FOR_STAGE: 'waiting_for_stage',
  WAITING_FOR_READINESS: 'waiting_for_readiness',
  WAITING_FOR_NAME: 'waiting_for_name',
  WAITING_FOR_PHONE: 'waiting_for_phone'
};

async function startChecklistForm(ctx) {
  const userId = ctx.from.id;
  
  // Сбрасываем состояние
  userStates.set(userId, {
    type: FORM_TYPES.CHECKLIST,
    step: CHECKLIST_STEPS.WAITING_FOR_START,
    data: {}
  });

  await ctx.reply(
    'Мы подготовили короткий чек-лист, который поможет понять,\n' +
    'готова ли ваша кухня к проверке.\n' +
    'Ответьте на несколько вопросов — и вы получите его бесплатно.',
    Markup.keyboard([['Начать']]).resize()
  );
}

async function startAuditForm(ctx) {
  const userId = ctx.from.id;
  
  // Сбрасываем состояние
  userStates.set(userId, {
    type: FORM_TYPES.AUDIT,
    step: AUDIT_STEPS.WAITING_FOR_NAME,
    data: {}
  });

  await ctx.reply(
    'Здравствуйте! Для оформления заявки на аудит, пожалуйста, заполните следующие данные:'
  );
  await ctx.reply('Укажите вашу фамилию и имя:');
}

// Обработка ответов для формы аудита
async function handleAuditResponse(ctx) {
  const userId = ctx.from.id;
  const state = userStates.get(userId);
  
  if (!state || state.type !== FORM_TYPES.AUDIT) {
    return false;
  }

  const text = ctx.message?.text || '';

  switch (state.step) {
    case AUDIT_STEPS.WAITING_FOR_NAME:
      state.data.name = text;
      state.step = AUDIT_STEPS.WAITING_FOR_ORGANIZATION;
      await ctx.reply('Укажите название вашей организации:');
      return true;

    case AUDIT_STEPS.WAITING_FOR_ORGANIZATION:
      state.data.organization = text;
      state.step = AUDIT_STEPS.WAITING_FOR_PHONE;
      await ctx.reply('Укажите ваш номер телефона:');
      return true;

    case AUDIT_STEPS.WAITING_FOR_PHONE:
      state.data.phone = text;
      
      // Отправляем данные админу
      const adminMessage = 
        '📋 Новая заявка на аудит:\n\n' +
        `👤 ФИО: ${state.data.name}\n` +
        `🏢 Организация: ${state.data.organization}\n` +
        `📞 Телефон: ${state.data.phone}\n` +
        `👤 Username: @${ctx.from.username || 'не указан'}`;

      try {
        await bot.telegram.sendMessage(ADMIN_ID, adminMessage);
        await ctx.reply('✅ Спасибо! Ваша заявка отправлена. Мы свяжемся с вами в ближайшее время.');
      } catch (e) {
        console.error('Ошибка при отправке сообщения админу:', e);
        await ctx.reply('✅ Спасибо! Ваша заявка принята. Мы свяжемся с вами в ближайшее время.');
      }
      
      // Очищаем состояние
      userStates.delete(userId);
      return true;

    default:
      return false;
  }
}

// Обработка ответов для формы чек-листа
async function handleChecklistResponse(ctx) {
  const userId = ctx.from.id;
  const state = userStates.get(userId);
  
  if (!state || state.type !== FORM_TYPES.CHECKLIST) {
    return false;
  }

  const text = ctx.message?.text || '';

  switch (state.step) {
    case CHECKLIST_STEPS.WAITING_FOR_START:
      if (text === 'Начать') {
        state.step = CHECKLIST_STEPS.WAITING_FOR_COMPANY;
        await ctx.reply('Укажите название вашей компании:', Markup.removeKeyboard());
        return true;
      }
      return false;

    case CHECKLIST_STEPS.WAITING_FOR_COMPANY:
      state.data.company = text;
      state.step = CHECKLIST_STEPS.WAITING_FOR_FORMAT;
      await ctx.reply(
        'Какой у вас формат?',
        Markup.keyboard([
          ['Кафе / ресторан'],
          ['Бар / кофейня'],
          ['Столовая'],
          ['Пекарня / кулинария'],
          ['Производственная кухня'],
          ['Другое']
        ]).resize()
      );
      return true;

    case CHECKLIST_STEPS.WAITING_FOR_FORMAT:
      state.data.format = text;
      state.step = CHECKLIST_STEPS.WAITING_FOR_STAGE;
      await ctx.reply(
        'На каком этапе вы сейчас?',
        Markup.keyboard([
          ['Работаем, были проверки'],
          ['Работаем, проверок не было'],
          ['Открытие / запуск'],
          ['Получали предписание']
        ]).resize()
      );
      return true;

    case CHECKLIST_STEPS.WAITING_FOR_STAGE:
      state.data.stage = text;
      state.step = CHECKLIST_STEPS.WAITING_FOR_READINESS;
      await ctx.reply(
        'Как вы оцениваете готовность предприятия к проверке?',
        Markup.keyboard([
          ['Уверены, всё в порядке'],
          ['Есть сомнения'],
          ['Скорее не готовы']
        ]).resize()
      );
      return true;

    case CHECKLIST_STEPS.WAITING_FOR_READINESS:
      state.data.readiness = text;
      state.step = CHECKLIST_STEPS.WAITING_FOR_NAME;
      await ctx.reply('Укажите ваше имя и фамилию:', Markup.removeKeyboard());
      return true;

    case CHECKLIST_STEPS.WAITING_FOR_NAME:
      state.data.name = text;
      state.step = CHECKLIST_STEPS.WAITING_FOR_PHONE;
      await ctx.reply('Укажите ваш номер телефона:');
      return true;

    case CHECKLIST_STEPS.WAITING_FOR_PHONE:
      state.data.phone = text;
      
      // Отправляем финальное сообщение и PDF
      await ctx.reply(
        'Направляем вам упрощённый чек-лист первичной самопроверки.\n' +
        'Он позволяет оценить базовые требования и организации процессов.'
      );

      // Отправляем PDF (путь нужно будет настроить)
      try {
        const pdfPath = join(__dirname, 'Провека кухни - ХАССП.pdf');
        await ctx.replyWithDocument({
          source: readFileSync(pdfPath),
          filename: 'Провека кухни - ХАССП.pdf'
        });
      } catch (e) {
        console.error('Ошибка при отправке PDF:', e);
        await ctx.reply('⚠️ Файл чек-листа временно недоступен. Пожалуйста, свяжитесь с администратором.');
      }

      // Отправляем данные админу
      const adminMessage = 
        '📋 Новая заявка на чек-лист:\n\n' +
        `🏢 Компания: ${state.data.company}\n` +
        `📋 Формат: ${state.data.format}\n` +
        `📊 Этап: ${state.data.stage}\n` +
        `✅ Готовность: ${state.data.readiness}\n` +
        `👤 ФИО: ${state.data.name}\n` +
        `📞 Телефон: ${state.data.phone}\n` +
        `👤 Username: @${ctx.from.username || 'не указан'}`;

      try {
        await bot.telegram.sendMessage(ADMIN_ID, adminMessage);
      } catch (e) {
        console.error('Ошибка при отправке сообщения админу:', e);
      }
      
      // Очищаем состояние
      userStates.delete(userId);
      return true;

    default:
      return false;
  }
}

bot.start((ctx) => {
  const payload = ctx.startPayload

  if (payload === 'checklist') {
    startChecklistForm(ctx)
  } else if (payload === 'audit') {
    startAuditForm(ctx)
  }
})

bot.command('checklist', async (ctx) => {
  startChecklistForm(ctx)
})

bot.command('audit', async (ctx) => {
  startAuditForm(ctx)
})

bot.command('myid', async (ctx) => {
  try {
    await ctx.reply(`Ваш ID: ${ctx.from.id}`);
  } catch (e) {
    console.error('Необработанная ошибка в команде /myid', e);
  }
});

// Обработчик текстовых сообщений (регистрируется после команд)
bot.on('text', async (ctx) => {
  // Пропускаем команды - проверяем через entities для надежности
  const isCommand = ctx.message.entities?.some(
    entity => entity.type === 'bot_command'
  );
  
  if (isCommand || ctx.message.text?.startsWith('/')) {
    return;
  }

  // Пробуем обработать как ответ на форму аудита
  if (await handleAuditResponse(ctx)) {
    return;
  }

  // Пробуем обработать как ответ на форму чек-листа
  if (await handleChecklistResponse(ctx)) {
    return;
  }
});

// Запуск long polling
bot.launch().then(() => console.log('🤖 Bot started'));

// Корректная остановка при SIGINT/SIGTERM
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
