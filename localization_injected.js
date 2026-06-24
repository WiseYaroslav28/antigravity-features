// ---------------------------------------------------------------------------
// Language Translation System (RU / EN) for Injected Chromium Pages
// ---------------------------------------------------------------------------

function normalizeText(str) {
    if (!str) return '';
    return str.replace(/[\s\u00a0\xa0\u2007\u202f\r\n\t]+/g, ' ').trim();
}

function translateDuration(text) {
    if (!text) return text;
    const pluralize = (count, one, two, five) => {
        const n = Math.abs(count) % 100;
        const n1 = n % 10;
        if (n > 10 && n < 20) return five;
        if (n1 > 1 && n1 < 5) return two;
        if (n1 === 1) return one;
        return five;
    };
    let result = text.replace(/(\d+)\s*days?/gi, (m, p1) => {
        const count = parseInt(p1, 10);
        return `${count} ${pluralize(count, 'день', 'дня', 'дней')}`;
    });
    result = result.replace(/(\d+)\s*hours?/gi, (m, p1) => {
        const count = parseInt(p1, 10);
        return `${count} ${pluralize(count, 'час', 'часа', 'часов')}`;
    });
    result = result.replace(/(\d+)\s*minutes?/gi, (m, p1) => {
        const count = parseInt(p1, 10);
        return `${count} ${pluralize(count, 'минуту', 'минуты', 'минут')}`;
    });
    result = result.replace(/\band\b/gi, 'и');
    return result;
}

function translateText(text) {
    if (!text) return text;
    const normalized = normalizeText(text);
    if (!normalized) return text;
    const lowerText = normalized.toLowerCase();
    
    let translated = null;
    if (translationDictionary[lowerText]) {
        translated = translationDictionary[lowerText];
    } else {
        for (const rule of regexTranslations) {
            const match = normalized.match(rule.pattern);
            if (match) {
                translated = rule.replace(match);
                break;
            }
        }
    }
    
    if (translated) {
        const matchSpaces = text.match(/^(\s*)(.*?)(\s*)$/);
        if (matchSpaces) {
            return matchSpaces[1] + translated + matchSpaces[3];
        }
        return translated;
    }
    return text;
}

const translationDictionary = {
    // Шапка и навигация
    "antigravity": "Антигравити",
    "file": "Файл",
    "view": "Вид",
    "window": "Окно",
    "new conversation": "Новый диалог",
    "conversation history": "История диалогов",
    "scheduled tasks": "Запланированные задачи",
    "projects": "Проекты",
    "conversations": "Диалоги",
    "see all": "Показать все",
    
    // Поле ввода чата
    "ask anything, @ to mention, / for actions": "Спросите о чём угодно, @ для упоминания, / для действий",
    
    // Настройки - Левая колонка
    "account": "Аккаунт",
    "permissions": "Разрешения",
    "customizations": "Персонализация",
    "browser": "Браузер",
    "app": "Приложение",
    "show all": "Показать все",
    "not in project": "Вне проекта",
    "shortcuts": "Горячие клавиши",
    "provide feedback": "Оставить отзыв",
    
    // Настройки - Блок "Conversations" (Диалоги)
    "agent settings and permissions for conversations outside of projects.": "Настройки агента и разрешения для диалогов вне проектов.",
    "agent settings": "Настройки агента",
    "security preset": "Профиль безопасности",
    "choose a predefined security preset for the agent. this controls terminal auto-execution policy, and file access policy.": "Выберите профиль безопасности агента. Он управляет автовыполнением команд в терминале и доступом к файлам.",
    "outside of folders file access policy": "Доступ к файлам вне рабочих папок",
    "configures how the agent tries to access files outside of its working folders.": "Определяет, как агент запрашивает доступ к файлам вне его рабочих директорий.",
    "terminal command auto execution": "Автовыполнение команд в терминале",
    "controls whether terminal commands require your approval before running.": "Управляет тем, требуется ли ваше подтверждение перед выполнением команд в терминале.",
    "agent behavior": "Поведение агента",
    "artifact review policy": "Проверка создаваемых документов (артефактов)",
    "specifies agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.": "Определяет поведение агента при создании артефактов (документов, планов разработки и т.д.).",
    "local permissions": "Локальные разрешения",
    "inherits from global settings. local permissions have higher priority. learn more.": "Наследуются от глобальных настроек. Локальные разрешения имеют более высокий приоритет. Подробнее.",
    "file access rules": "Правила доступа к файлам",
    "configure allowed and denied paths for file reads and writes.": "Настройка разрешенных и запрещенных путей для чтения и записи файлов.",
    "network access rules": "Правила доступа к сети",
    "configure allowed and denied urls for reading.": "Настройка разрешенных и запрещенных URL-адресов для чтения веб-страниц.",
    "terminal commands": "Команды терминала",
    "configure allowed terminal commands.": "Настройка списка разрешенных команд терминала.",
    
    // Настройки - Значения кнопок и выпадающих списков
    "custom": "Вручную",
    "always ask": "Всегда спрашивать",
    "require review": "Требовать подтверждение",
    "open": "Открыть",
    
    // Общие элементы настроек
    "theme": "Тема оформления",
    "dark": "Темная",
    "light": "Светлая",
    "system": "Системная",
    "appearance": "Внешний вид",
    "general": "Общие",
    "advanced": "Дополнительно",
    "settings": "Настройки",
    "models": "Модели",
    "overview": "Обзор",
    "add context": "Добавить контекст",
    "quotas": "Лимиты квот",
    "by the way": "К слову (Быстрый вопрос)",
    
    // Кнопки
    "cancel": "Отмена",
    "save": "Сохранить",
    "close": "Закрыть",
    "done": "Готово",
    "ok": "ОК",
    "clear": "Очистить",
    "uninstall": "Удалить",
    "installed": "Установлено",
    "no conversations yet": "Пока нет диалогов",
    "(tell the agent what to do instead)": "(указать агенту, что делать вместо этого)",
    "are you sure you want to delete the project": "Вы уверены, что хотите удалить проект",
    "this will permanently delete": "Это навсегда удалит",
    "within it. this action cannot be undone.": "в нем. Это действие нельзя отменить.",
    "file reads": "Чтение файлов",
    "allow/deny agent read access to specific files or directories.": "Разрешить/запретить агенту доступ на чтение к определенным файлам или каталогам.",
    "ask": "Спрашивать",
    "file writes": "Запись файлов",
    "allow/deny agent write access to specific files or directories.": "Разрешить/запретить агенту доступ на запись к определенным файлам или каталогам.",
    "read urls": "Чтение URL-адресов",
    "allow/deny agent read access to specific urls or domains.": "Разрешить/запретить агенту доступ на чтение к определенным URL-адресам или доменам.",
    "allow/deny specific terminal commands.": "Разрешить/запретить определенные команды терминала.",
    "allow/deny agent command execution outside the sandbox.": "Разрешить/запретить агенту выполнение команд вне песочницы.",
    "external tools the agent can call via model context protocol.": "Внешние инструменты, которые агент может вызывать через Model Context Protocol.",
    "delete": "Удалить",
    "edit": "Редактировать",
    "check for updates": "Проверить обновления",
    "checking for updates...": "Проверка обновлений...",
    "downloading update...": "Загрузка обновления...",
    "restart to update": "Перезапустить для обновления",
    "create new window": "Создать новое окно",
    "open agent manager": "Открыть менеджер агентов",
    "open workspace": "Открыть рабочую область",
    "headless mode": "Фоновый режим",
    "active models": "Активные модели",
    "available models": "Доступные модели",
    "credits": "Кредиты",
    "quota": "Лимит",
    "remaining": "Осталось",
    "used": "Использовано",
    "limit": "Ограничение",
    "total limit": "Общий лимит",
    "usage": "Использование",
    "model name": "Название модели",
    "files": "Файлы",
    "folders": "Папки",
    "terminal": "Терминал",
    "web search": "Поиск в сети",
    "add file": "Добавить файл",
    "add folder": "Добавить папку",
    "drag and drop files here": "Перетащите файлы сюда",
    "or click to browse": "или нажмите для выбора",
    "active agents": "Активные агенты",
    "subagents": "Субагенты",
    "conversation id": "ID беседы",
    "status": "Статус",
    "logs": "Логи",
    "tasks": "Задачи",
    "no active agents": "Нет активных агентов",
    "security": "Безопасность",
    "network": "Сеть",
    "system preferences": "Системные настройки",
    "no updates available": "Нет доступных обновлений",
    "update available": "Доступно обновление",
    "downloading update": "Скачивание обновления",
    "restart to apply update": "Перезапустите, чтобы применить обновление",
    "available ai credits:": "Доступные кредиты ИИ:",
    "available ai credits": "Доступные кредиты ИИ",

    // --- НОВЫЕ СТРОКИ ДЛЯ РУСИФИКАЦИИ ---
    "pinned conversations": "Закрепленные диалоги",
    "new project": "Новый проект",
    "quick start": "Быстрый старт",
    "no project": "Без проекта",
    "create project": "Создать проект",
    "command palette": "Палитра команд",
    "zoom in": "Увеличить масштаб",
    "zoom out": "Уменьшить масштаб",
    "reset zoom": "Сбросить масштаб",
    "minimize": "Свернуть",
    "maximize": "Развернуть",
    "docs": "Документация",
    "new window": "Создать новое окно",

    "inherits from": "Наследуется от",
    "global settings": "глобальных настроек",
    ". local permissions have higher priority.": ". Локальные разрешения имеют более высокий приоритет.",
    "local permissions have higher priority": "Локальные разрешения имеют более высокий приоритет",
    "learn more": "Подробнее",
    "commands outside sandbox": "Команды вне песочницы",
    "configure allowed commands outside the sandbox.": "Настройка разрешенных команд вне песочницы.",
    "mcp tools": "Инструменты MCP",
    "configure external tools via model context protocol.": "Настройка внешних инструментов через Model Context Protocol (MCP).",

    "the breakdown below shows token usage from customizations like skills, rules, and mcp. if the budget is exceeded, large customizations will be truncated automatically.": "В разбивке ниже показано использование токенов кастомизациями, такими как навыки, правила и MCP. Если бюджет превышен, крупные кастомизации будут автоматически усечены.",
    "rules": "Правила",
    "skills": "Навыки",
    "global": "Глобально",

    "allowed paths": "Разрешенные пути",
    "denied paths": "Запрещенные пути",
    "add path": "Добавить путь",
    "allowed urls": "Разрешенные URL",
    "denied urls": "Запрещенные URL",
    "add url": "Добавить URL",
    "allowed commands": "Разрешенные команды",
    "add command": "Добавить команду",
    "command prefix": "Префикс команды",
    "domain": "Домен",
    "read": "Чтение",
    "write": "Запись",
    "read/write": "Чтение/Запись",

    "see less": "Скрыть",
    "default": "По умолчанию",
    "hide breakdowns": "Скрыть детали",
    
    "configure the agent's visual theme and display preferences.": "Настройка визуальной темы и параметров отображения агента.",
    "chat settings": "Настройки чата",
    "verbose agent chat": "Подробный чат агента",
    "display and preserve intermediate thinking steps": "Отображать и сохранять промежуточные шаги размышления",
    "select light, dark, or inherit system settings.": "Выберите светлую, темную или системную тему.",
    "light theme": "Светлая тема",
    "dark theme": "Темная тема",
    "preset": "Профиль",
    "background": "Фон",
    "foreground": "Текст",
    "accent": "Акцент",
    "default light": "Светлая по умолчанию",
    "default dark": "Темная по умолчанию",

    "useful for typical development with an emphasis on security. it prioritizes safety over speed by requiring manual approval for all terminal commands and files outside the project directory.": "Полезно для обычной разработки с акцентом на безопасность. Приоритет отдается безопасности, а не скорости, требуя ручного подтверждения для всех команд терминала и файлов вне директории проекта.",
    "learn more about": "Подробнее о",
    "refresh": "Обновить",
    "plan": "Тариф",
    "model credits": "Баланс кредитов",
    "enable ai credit overages": "Разрешить перерасход кредитов",
    "when toggled on, antigravity will use your ai credits to fulfill model requests once you're out of model quota. antigravity will always use your model quota first before using ai credits.": "Если этот параметр включен, Antigravity будет использовать ваши кредиты для выполнения запросов к моделям, когда закончится квота. Antigravity всегда сначала использует квоту моделей, прежде чем тратить кредиты.",
    "see activity": "История операций",
    "get more ai credits": "Купить кредиты",
    "model quota": "Квоты моделей",
    "within each group, models share a weekly limit and a 5-hour limit. quota is consumed proportionally to the cost of the tokens. thus, limits will last longer with shorter tasks or using more cost-effective models. the 5-hour limit smooths out aggregate demand to fairly distribute global capacity across all users, while your weekly limit is tied directly to your individual tier.": "Внутри каждой группы модели делят недельный лимит и 5-часовой лимит. Квота расходуется пропорционально стоимости токенов. Таким образом, лимитов хватит на дольше при коротких задачах или использовании более экономичных моделей. 5-часовой лимит сглаживает совокупный спрос для справедливого распределения ресурсов между всеми пользователями, в то время как недельный лимит привязан к вашему тарифному плану.",
    "gemini models": "Модели Gemini",
    "claude and gpt models": "Модели Claude и GPT",
    "weekly limit": "Недельный лимит",
    "five hour limit": "5-часовой лимит",
    "configure default behaviors, skills, and mcp servers.": "Настройка поведения по умолчанию, навыков и серверов MCP.",
    
    "requires manual review for all terminal commands and file accesses outside of the working folders.": "Требует ручного подтверждения для всех команд терминала и обращений к файлам вне рабочих папок.",
    "full machine": "Полный доступ к системе",
    "all terminal commands require review. the agent can read or write to any file in the machine.": "Все команды терминала требуют подтверждения. Агент может читать и писать любые файлы на компьютере.",
    "turbo mode": "Турбо-режим",
    "disables all safety barriers for maximal iteration velocity.": "Отключает все барьеры безопасности для максимальной скорости итерации.",
    "manually customize individual settings.": "Ручная настройка отдельных параметров.",
    "allow": "Разрешить",
    "deny": "Запретить",
    "always proceed": "Всегда выполнять",

    "manage your plan, credentials, and general preferences.": "Управление вашим тарифом, учетными данными и общими настройками.",
    "enable telemetry": "Разрешить телеметрию",
    "when toggled on, antigravity collects usage data to help google enhance performance and features.": "Если этот параметр включен, Antigravity собирает данные об использовании, чтобы помочь Google улучшить производительность и функции.",
    "marketing emails": "Маркетикивые рассылки",
    "receive product updates, tips, and promotions from google antigravity via email.": "Получать обновления продуктов, советы и промо-акции от Google Antigravity по электронной почте.",
    "you can upgrade to a higher google ai ultra plan to receive the highest rate limits.": "Вы можете перейти на более высокий тариф Google AI Ultra, чтобы получить максимальные лимиты.",
    "upgrade": "Сменить тариф",
    "sign out": "Выйти",
    "by using this app, you agree to its": "Используя это приложение, вы соглашаетесь с его",
    "terms of service": "Условиями использования",

    "danger zone": "Опасная зона",
    "delete project": "Удалить проект",
    "project-specific settings": "Настройки для конкретных проектов",
    "modify scoped permissions, folders, and agent settings like sandbox and terminal command execution.": "Изменение прав доступа, папок и настроек агента, таких как песочница и выполнение терминальных команд.",
    "go to projects": "Перейти к проектам",
    "file permissions": "Разрешения для файлов",
    "network permissions": "Разрешения для сети",
    "terminal & tooling permissions": "Разрешения для терминала и инструментов",
    "configure global allowed and denied resource permissions.": "Настройка глобальных разрешений доступа к ресурсам.",
    "of the customization budget is available.": " бюджета кастомизаций доступно.",
    "of the customization budget is available": " бюджета кастомизаций доступно",
    "% of the customization budget is available.": " % бюджета кастомизаций доступно.",
    "% of the customization budget is available": " % бюджета кастомизаций доступно",
    "hide breakdown": "Скрыть детали",

    "manage project folders, agent settings, and permissions.": "Управление папками проекта, настройками агента и разрешениями.",
    "installed mcp servers": "Установленные серверы MCP",
    "add mcp +": "Добавить MCP +",
    "build with google plugins": "Сборка с плагинами Google",
    "customize": "Настроить",

    "browser settings": "Настройки браузера",
    "configure the browser subagent. it requires": "Настройка браузера-субагента. Требуется установить",
    "to be installed. the browser subagent can be invoked by typing": "для запуска. Запустить браузер-субагент можно, введя",
    "in the conversation input box.": "в поле ввода сообщения.",
    "in the conversation input box": "в поле ввода сообщения",
    "browser javascript execution policy": "Политика выполнения JavaScript в браузере",
    "controls whether the agent can run custom javascript to automate complex browser actions.": "Определяет, может ли агент выполнять пользовательский JavaScript для автоматизации сложных действий в браузере.",
    "disabled": "Отключено",
    "enabled": "Включено",
    "actuation permissions": "Разрешения на управление",
    "browser actuation rules": "Правила выполнения действий в браузере",
    "configure allowed and denied urls for browser actuation.": "Настройка разрешенных и запрещенных URL-адресов для выполнения действий в браузере.",

    "back": "Назад",
    "request review": "Требовать подтверждение",
    "block all browser javascript execution.": "Блокировать все выполнение JavaScript в браузере.",
    "prompt for approval before running browser scripts.": "Запрашивать подтверждение перед запуском скриптов в браузере.",
    "allow full browser script execution without prompting.": "Разрешить полное выполнение скриптов в браузере без запроса.",
    "browser actuation permissions": "Разрешения на управление браузером",
    "execute urls": "Разрешенные URL-адреса",
    "allow/deny agent browser actuation access to specific urls.": "Разрешение/запрет доступа браузера-субагента к конкретным URL-адресам.",
    "add": "Добавить",

    "app settings": "Настройки приложения",
    "manage application settings.": "Управление настройками приложения.",
    "prevent sleep": "Запретить спящий режим",
    "prevent the computer from sleeping while the app is running.": "Запретить компьютеру переходить в спящий режим во время работы приложения.",
    "keep in menu bar": "Оставлять в трее",
    "the app will be accessible from the menu bar and will keep running in the background when all windows are closed.": "Приложение будет доступно из панели меню и продолжит работу в фоновом режиме, когда все окна закрыты.",
    "notifications": "Уведомления",
    "notification settings": "Настройки уведомлений",
    "to modify notification settings, open your operating system's system preferences.": "Чтобы изменить настройки уведомлений, откройте системные настройки вашей операционной системы.",
    "open system preferences": "Открыть системные настройки",

    "build with antigravity plugins": "Сборка с плагинами Antigravity",
    "plugins are packaged collections of skills and mcps to help the agent in": "Плагины — это пакетные наборы навыков и MCP, которые помогают Агенту в",
    "work with google developer products. you can always change your choices in settings.": "работать с продуктами Google для разработчиков. Вы всегда можете изменить свой выбор в Настройках.",
    "work with google developer products. you can always change your choices in settings": "работать с продуктами Google для разработчиков. Вы всегда можете изменить свой выбор в Настройках",
    "core tools and knowledge required to develop for android": "Основные инструменты и знания, необходимые для разработки под Android",
    "keep your coding agent up to date with the latest web best practices.": "Держите своего кодинг-агента в курсе последних передовых веб-технологий.",
    "using the antigravity python sdk to build ai agents": "Использование Antigravity Python SDK для создания ИИ-агентов",
    "science": "Наука",
    "curated collection of agent skills for science.": "Кураторская коллекция навыков агента для научных задач.",
    "prototype, build & run modern apps users love with firebase's backend, ai, and operational infrastructure.": "Прототипируйте, создавайте и запускайте современные приложения с помощью бэкенда, ИИ и операционной инфраструктуры Firebase.",
    "reliable automation, in-depth debugging, and performance analysis in chrome using chrome devtools and puppeteer": "Надежная автоматизация, глубокая отладка и анализ производительности в Chrome с использованием Chrome DevTools и Puppeteer",
    "reliable automation, in depth debugging, and performance analysis in chrome using chrome devtools and puppeteer": "Надежная автоматизация, глубокая отладка и анализ производительности в Chrome с использованием Chrome DevTools и Puppeteer",
    "download": "Скачать",

    "a high-risk mode that disables all safety barriers. the agent operates with full system access, auto-executes all terminal commands, and reads or writes to any file without review prompts.": "Высокорискованный режим, отключающий все барьеры безопасности. Агент работает с полным доступом к системе, автоматически выполняет все команды в терминале и читает или записывает любые файлы без запроса подтверждения.",
    "a high-risk mode that disables all safety barriers. the agent operates with full system access, auto-executes all terminal commands, and reads or writes to any file without review prompts": "Высокорискованный режим, отключающий все барьеры безопасности. Агент работает с полным доступом к системе, автоматически выполняет все команды в терминале и читает или записывает любые файлы без запроса подтверждения.",
    "a high-risk mode that disables all safety barriers. the agent operates with full system access, auto-executes all terminal commands, and reads or writes to all local files without review prompts.": "Высокорискованный режим, отключающий все барьеры безопасности. Агент работает с полным доступом к системе, автоматически выполняет все команды в терминале и читает или записывает любые файлы на компьютере без запросов подтверждения.",
    "a high-risk mode that disables all safety barriers. the agent operates with full system access, auto-executes all terminal commands, and reads or writes to all local files without review prompts": "Высокорискованный режим, отключающий все барьеры безопасности. Агент работает с полным доступом к системе, автоматически выполняет все команды в терминале и читает или записывает любые файлы на компьютере без запросов подтверждения.",
    
    "permanently delete": "Навсегда удалить",
    "including": " включая",
    "active conversations and": " активных диалогов и",
    "active conversation and": " активного диалога и",
    "active conversations": " активных диалогов",
    "active conversation": " активного диалога",
    "archived conversations.": " архивированных диалогов.",
    "archived conversation.": " архивированного диалога.",
    "archived conversations": " архивированных диалогов",
    "archived conversation": " архивированного диалога",
    "archived": " архивированных",
    "conversations.": " диалогов.",
    "conversations": " диалогов",
    "conversation.": " диалога.",
    "conversation": " диалог",
    "and": " и",
    "token usage": "Использование токенов",

    "feedback type": "Тип отзыва",
    "bug report": "Отчет об ошибке",
    "feature request": "Запрос функции",
    "auth and billing": "Авторизация и оплата",
    "general feedback": "Общий отзыв",
    "description": "Описание",
    "please describe the issue in detail. the more actionable your feedback, the quicker our team can address your request. some helpful information includes:": "Пожалуйста, подробно опишите проблему. Чем конкретнее отзыв, тем быстрее наша команда сможет ее решить. Полезная информация включает:",
    "steps to reproduce the issue": "Шаги для воспроизведения проблемы",
    "expected behavior": "Ожидаемое поведение",
    "actual behavior": "Фактическое поведение",
    "any error messages": "Любые сообщения об ошибках",
    "any relevant information": "Любая важная информация",
    "describe the bug you encountered...": "Опишите найденную ошибку...",
    "steps to reproduce": "Шаги для воспроизведения",
    "please list the steps to reproduce the issue": "Пожалуйста, перечислите шаги для воспроизведения проблемы",
    "attach a screenshot (optional)": "Прикрепить скриншот (необязательно)",
    "attach antigravity server logs": "Прикрепить логи сервера Antigravity",

    "keyboard shortcuts for quick navigation and control.": "Сочетания клавиш для быстрой навигации и управления.",
    "recommended": "Рекомендованные",
    "open conversation picker": "Открыть выбор диалога",
    "open file search": "Открыть поиск файлов",
    "focus input": "Фокусировать поле ввода",
    "navigation": "Навигация",
    "go back": "Назад",
    "go forward": "Вперед",
    "file picker": "Выбор файлов",
    "select previous conversation": "Выбрать предыдущий диалог",
    "select next conversation": "Выбрать следующий диалог",
    "open settings": "Открыть настройки",
    "toggle model selector": "Показать/скрыть выбор модели",
    "toggle voice recording": "Включить/выключить голосовую запись",
    "find in pane": "Найти на панели",
    "layout controls": "Управление макетом",
    "toggle sidebar": "Показать/скрыть боковую панель",
    "toggle auxiliary pane": "Показать/скрыть вспомогательную панель",

    "+ new": "+ Создать",
    "new": "Создать",
    "search tasks...": "Поиск задач...",
    "no scheduled tasks configured.": "Нет запланированных задач.",
    "search conversations...": "Поиск диалогов...",
    "filter": "Фильтр",
    "outside of project": "Вне проекта",

    "new scheduled task": "Новая запланированная задача",
    "enter scheduled task name...": "Введите название запланированной задачи...",
    "schedule": "Расписание",
    "prompt": "Запрос (промпт)",
    "enter a prompt for the agent to run...": "Введите запрос для запуска агентом...",
    "all scheduled tasks run as flash.": "Все запланированные задачи выполняются как Flash.",
    "add scheduled task": "Добавить запланированную задачу",
    "daily": "Ежедневно",
    "weekly": "Еженедельно",
    "hourly": "Ежечасно",
    "monthly": "Ежемесячно",
    "around": "около",

    "files changed": "Измененные файлы",
    "artifacts": "Артефакты",
    "background tasks": "Фоновые задачи",
    
    "allow running this command?": "Разрешить запуск этой команды?",
    "yes, allow this time": "Да, разрешить в этот раз",
    "no (tell the agent what to do instead)": "Нет (указать агенту, что делать вместо этого)",
    "skip": "Пропустить",
    "submit": "Отправить",

    "agent terminated due to error": "Работа агента завершена из-за ошибки",
    "you can prompt the model to try again or start a new conversation if the error persists.": "Вы можете попросить модель повторить попытку или начать новый диалог, если ошибка повторится.",
    "see our troubleshooting guide for more help.": "Для получения дополнительной информации см. наше руководство по устранению неполадок.",
    "dismiss": "Закрыть",
    "copy debug info": "Копировать отладочную информацию",
    "retry": "Повторить",

    "allow write access to this path?": "Разрешить доступ на запись по этому пути?",
    "allow read access to this path?": "Разрешить доступ на чтение по этому пути?",
    "allow execute access to this path?": "Разрешить доступ на выполнение по этому пути?",
    "allow command execution?": "Разрешить выполнение команды?",
    
    // MCP Tools and Dialogs
    "allow using this mcp tool?": "Разрешить использование этого MCP-инструмента?",
    "add mcp servers": "Добавить MCP-серверы",
    "search mcp servers by name": "Поиск MCP-серверов по имени",
    "mcp toolbox for databases": "Набор инструментов MCP для баз данных",
    "knowledge catalog": "Каталог знаний",
    "oracle database": "База данных Oracle",
    "query your gitlab sdlc as a knowledge graph. orbit indexes groups, projects, source code, merge requests, pipelines, work items, and security findings into a single graph...": "Запросы к вашему GitLab SDLC в виде графа знаний. Orbit индексирует группы, проекты, исходный код, запросы на слияние, пайплайны, рабочие элементы и результаты безопасности в единый граф...",
    "enable antigravity to deploy apps to google cloud run.": "Позволяет Antigravity развертывать приложения в Google Cloud Run.",
    "interact directly with the posthog product analytics platform using natural language. run queries, manage feature flags, track errors, and manage projects.": "Взаимодействуйте напрямую с платформой продуктовой аналитики PostHog на естественном языке. Запускайте запросы, управляйте флагами функций, отслеживайте ошибки и управляйте проектами.",
    "enable antigravity to interact with google kubernetes engine (oss).": "Позволяет Antigravity взаимодействовать с Google Kubernetes Engine (GKE).",
    "the dart and flutter mcp server exposes dart (and flutter) development tool actions to compatible ai-assistant clients.": "MCP-сервер Dart и Flutter предоставляет действия инструментов разработки Dart (и Flutter) для совместимых клиентов AI-ассистентов.",
    "the firebase model context protocol (mcp) server gives ai-powered development tools the ability to work with your firebase projects and your app's codebase.": "MCP-сервер Firebase дает инструментам разработки на базе ИИ возможность работать с вашими проектами Firebase и кодовой базой вашего приложения.",
    "the genkit model context protocol (mcp) server gives ai-powered development tools the ability to build, debug and inspect your genkit app.": "MCP-сервер Genkit дает инструментам разработки на базе ИИ возможность собирать, отлаживать и инспектировать ваше приложение Genkit.",
    "the gopls model context protocol (mcp) server provides tools for semantic code analysis, live diagnostics, and transformation of your non-google3 go codebase.": "MCP-сервер gopls предоставляет инструменты для семантического анализа кода, живой диагностики и преобразования вашей кодовой базы Go (не-google3).",
    "interact with your bigquery data using natural language. this mcp server allows you to securely connect to your datasets to search the datasets, inspect table metadata,...": "Взаимодействуйте с вашими данными BigQuery на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашим наборам данных для поиска, проверки метаданных таблиц...",
    "interact with your alloydb for postgresql data using natural language. this mcp server allows you to securely connect to your database for executing sql queries,...": "Взаинтересуйте с вашими данными AlloyDB для PostgreSQL на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашей базе данных для выполнения SQL-запросов...",
    "the bigtable admin remote mcp server lets you manage bigtable resources.": "Удаленный MCP-сервер Bigtable Admin позволяет управлять ресурсами Bigtable.",
    "the spanner remote mcp server lets you access and run spanner tools to create, manage, and query spanner resources from your ai-enabled development...": "Удаленный MCP-сервер Spanner позволяет получать доступ и запускать инструменты Spanner для создания, управления и выполнения запросов к ресурсам Spanner из вашей среды разработки с поддержкой ИИ...",
    "interact with your cloud sql for postgresql data using natural language. this mcp server allows you to securely connect to your database for executing sql queries,...": "Взаимодействуйте с вашими данными Cloud SQL for PostgreSQL на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашей базе данных для выполнения SQL-запросов...",
    "interact with your cloud sql for mysql data using natural language. this mcp server allows you to securely connect to your database for executing sql queries, inspectin...": "Взаимодействуйте с вашими данными Cloud SQL for MySQL на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашей базе данных для выполнения SQL-запросов, проверки...",
    "interact with your cloud sql for sql server data using natural language. this mcp server allows you to securely connect to your database for executing sql queries,...": "Взаимодействуйте с вашими данными Cloud SQL for SQL Server на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашей базе данных для выполнения SQL-запросов...",
    "connect your ai assistants to looker business intelligence. this mcp server enables data exploration and content management by allowing you to execute natural...": "Подключите ваших ИИ-ассистентов к бизнес-аналитике Looker. Этот MCP-сервер позволяет исследовать данные и управлять контентом, выполняя естественные...",
    "connect your ai assistants to the knowledge catalog (formerly known as dataplex). this mcp server enables data discovery and governance by allowing you to search f...": "Подключите ваших ИИ-ассистентов к Каталогу знаний (ранее известному как Dataplex). Этот MCP-сервер позволяет находить данные и управлять ими, выполняя поиск...",
    "the mcp toolbox for databases is an open-source mcp server designed to simplify and secure the development of tools for interacting with databases.": "MCP Toolbox для баз данных — это MCP-сервер с открытым исходным кодом, созданный для упрощения и обеспечения безопасности разработки инструментов взаимодействия с базами данных.",
    "alloydb for postgresql admin mcp server enables ai assistants to interact with alloydb for postgresql resources, including creating clusters and administering users.": "MCP-сервер AlloyDB для PostgreSQL Admin позволяет ИИ-ассистентам взаимодействовать с ресурсами AlloyDB для PostgreSQL, включая создание кластеров и администрирование пользователей.",
    "cloud sql for postgresql admin mcp server enables ai assistants to interact with cloud sql for postgresql resources, including creating instances, administering use...": "MCP-сервер Cloud SQL для PostgreSQL Admin позволяет ИИ-ассистентам взаимодействовать с ресурсами Cloud SQL для PostgreSQL, включая создание инстансов, администрирование...",
    "cloud sql for mysql admin mcp server enables ai assistants to interact with cloud sql for mysql resources, including creating instances, administering users, and...": "MCP-сервер Cloud SQL для MySQL Admin позволяет ИИ-ассистентам взаимодействовать с ресурсами Cloud SQL для MySQL, включая создание инстансов, администрирование пользователей и...",
    "cloud sql for sql server admin mcp server enables ai assistants to interact with cloud sql for sql server resources, including creating instances, administering user...": "MCP-сервер Cloud SQL для SQL Server Admin позволяет ИИ-ассистентам взаимодействовать с ресурсами Cloud SQL для SQL Server, включая создание инстансов, администрирование...",
    "interact with your oracle database data using natural language. this mcp server allows you to securely connect to your databases for executing sql queries,...": "Взаимодействуйте с вашими данными Oracle Database на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашим базам данных для выполнения SQL-запросов...",
    "the dev mode mcp server brings figma directly into your workflow by providing important design information and context to ai agents generating code from figma...": "MCP-сервер Dev Mode переносит Figma напрямую в ваш рабочий процесс, предоставляя важную информацию о дизайне и контекст ИИ-агентам, генерирующим код из Figma...",
    "the github mcp server is a model context protocol (mcp) server that provides seamless integration with github apis, enabling advanced automation and interactio...": "MCP-сервер GitHub — это сервер Model Context Protocol, обеспечивающий бесшовную интеграцию с API GitHub, что делает возможным продвинутую автоматизацию и взаимодействие...",
    "neon mcp server is an open-source tool that lets you interact with your neon postgres databases in natural language.": "MCP-сервер Neon — это инструмент с открытым исходным кодом, который позволяет вам взаимодействовать с базами данных Neon Postgres на естественном языке.",
    "the stripe model context protocol server allows you to integrate with stripe apis through function calling. this protocol supports various tools to interact with differe...": "MCP-сервер Stripe позволяет интегрироваться с API Stripe посредством вызова функций. Этот протокол поддерживает различные инструменты для взаимодействия с...",
    "interact with redis key-value stores": "Взаимодействуйте с хранилищами ключ-значение Redis",
    "a model context protocol server for interacting with mongodb atlas.": "Сервер Model Context Protocol для взаимодействия с MongoDB Atlas.",
    "official notion mcp server that allows interaction with notion workspaces, pages, databases, and comments via the notion api.": "Официальный MCP-сервер Notion, позволяющий взаимодействовать с рабочими пространствами, страницами, базами данных и комментариями Notion через Notion API.",
    "official linear.app mcp server for interacting with linear projects, issues, and workflows.": "Официальный MCP-сервер Linear.app для взаимодействия с проектами, задачами и рабочими процессами Linear.",
    "an mcp server implementation that integrates the perplexity sonar api to provide real-time, web-wide research capabilities.": "Реализация MCP-сервера, которая интегрирует Perplexity Sonar API для предоставления возможностей поиска в реальном времени по всей сети.",
    "official paypal mcp server that allows integration with paypal apis for payment processing, transaction management, and account operations.": "Официальный MCP-сервер PayPal, позволяющий интегрироваться с API PayPal для обработки платежей, управления транзакциями и операций с аккаунтами.",
    "the heroku platform mcp server enables seamless interaction with heroku platform resources, allowing llms to read, manage, and operate applications, add-ons,...": "MCP-сервер Heroku Platform обеспечивает бесшовное взаимодействие с ресурсами Heroku Platform, позволяя LLM читать, управлять и оперировать приложениями, аддонами...",
    "the pinecone mcp server enables ai tools to search pinecone documentation, configure indexes, generate code informed by your index configuration, and...": "MCP-сервер Pinecone позволяет инструментам ИИ искать в документации Pinecone, настраивать индексы, генерировать код на основе конфигурации ваших индексов и...",
    "connect your supabase projects to ai assistants. this mcp server allows managing tables, fetching config, executing sql queries, managing edge functions, and workin...": "Подключите ваши проекты Supabase к ИИ-ассистентам. Этот MCP-сервер позволяет управлять таблицами, получать конфигурацию, выполнять SQL-запросы, управлять edge-функциями и работать..."
};

const regexTranslations = [
    {
        // "1 task running" / "2 tasks running"
        pattern: /^(\d+)\s+tasks?\s+running$/i,
        replace: (match) => {
            const count = parseInt(match[1], 10);
            const pluralize = (count, one, two, five) => {
                const n = Math.abs(count) % 100;
                const n1 = n % 10;
                if (n > 10 && n < 20) return five;
                if (n1 > 1 && n1 < 5) return two;
                if (n1 === 1) return one;
                return five;
            };
            const word = pluralize(count, 'задача запущена', 'задачи запущены', 'задач запущено');
            return `${count} ${word}`;
        }
    },
    {
        // "1 Yes, allow this time" -> "1 Да, разрешить в этот раз"
        pattern: /^(?:\d+[\s.]*)?yes,\s*allow\s*this\s*time$/i,
        replace: (match) => {
            const prefix = match[0].match(/^(\d+[\s.]*)/)?.[1] || '';
            return `${prefix}Да, разрешить в этот раз`;
        }
    },
    {
        // "2 Yes, and always allow when not in a project" -> "2 Да, и всегда разрешать вне проекта"
        pattern: /^(?:\d+[\s.]*)?yes,\s*and\s*always\s*allow\s*when\s*not\s*in\s*a\s*project$/i,
        replace: (match) => {
            const prefix = match[0].match(/^(\d+[\s.]*)/)?.[1] || '';
            return `${prefix}Да, и всегда разрешать вне проекта`;
        }
    },
    {
        // "2 Yes, and always allow '...' in this project" -> "2 Да, и всегда разрешать '...' в этом проекте"
        pattern: /^(?:\d+[\s.]*)?yes,\s*and\s*always\s*allow\s+(.*?)in\s+this\s+project$/i,
        replace: (match) => {
            const prefix = match[0].match(/^(\d+[\s.]*)/)?.[1] || '';
            return `${prefix}Да, и всегда разрешать ${match[1]}в этом проекте`;
        }
    },
    {
        // "3 Yes, and always allow" -> "3 Да, и всегда разрешать"
        pattern: /^(?:\d+[\s.]*)?yes,\s*and\s*always\s*allow$/i,
        replace: (match) => {
            const prefix = match[0].match(/^(\d+[\s.]*)/)?.[1] || '';
            return `${prefix}Да, и всегда разрешать`;
        }
    },
    {
        // "3 Yes, and always allow '...'" -> "3 Да, и всегда разрешать '...'"
        pattern: /^(?:\d+[\s.]*)?yes,\s*and\s*always\s*allow\s+(.+)$/i,
        replace: (match) => {
            const prefix = match[0].match(/^(\d+[\s.]*)/)?.[1] || '';
            // Make sure it doesn't end with "in this project" to avoid matching the other one
            if (/in\s+this\s+project$/i.test(match[1])) {
                return match[0]; // Shouldn't happen due to ordering, but just in case
            }
            return `${prefix}Да, и всегда разрешать ${match[1]}`;
        }
    },
    {
        // "4 No (tell the agent what to do instead)" -> "4 Нет (указать агенту, что делать вместо этого)"
        pattern: /^(?:\d+[\s.]*)?no\s*\(tell\s+the\s+agent/i,
        replace: (match) => {
            const prefix = match[0].match(/^(\d+[\s.]*)/)?.[1] || '';
            return `${prefix}Нет (указать агенту, что делать вместо этого)`;
        }
    },
    {
        // "2 No" -> "2 Нет"
        pattern: /^(?:\d+[\s.]*)?no$/i,
        replace: (match) => {
            const prefix = match[0].match(/^(\d+[\s.]*)/)?.[1] || '';
            return `${prefix}Нет`;
        }
    },
    {
        pattern: /^see\s+all\s*\((\d+)\)$/i,
        replace: (match) => `Показать все (${match[1]})`
    },
    {
        pattern: /^file\s+access\s+rules\s*\(?(\d+)\)?$/i,
        replace: (match) => `Правила доступа к файлам (${match[1]})`
    },
    {
        pattern: /^file\s+access\s+rules\s+(\d+)$/i,
        replace: (match) => `Правила доступа к файлам (${match[1]})`
    },
    {
        pattern: /^(\d+)\s+active\s+conversation(s)?\.?$/i,
        replace: (match) => {
            const count = parseInt(match[1], 10);
            const hasDot = match[0].endsWith('.');
            let word = "активных диалогов";
            if (count % 10 === 1 && count % 100 !== 11) word = "активный диалог";
            else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) word = "активных диалога";
            return `${count} ${word}${hasDot ? '.' : ''}`;
        }
    },
    {
        pattern: /^(\d+)\s+archived\s+conversation(s)?\.?$/i,
        replace: (match) => {
            const count = parseInt(match[1], 10);
            const hasDot = match[0].endsWith('.');
            let word = "архивированных диалогов";
            if (count % 10 === 1 && count % 100 !== 11) word = "архивированный диалог";
            else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) word = "архивированных диалога";
            return `${count} ${word}${hasDot ? '.' : ''}`;
        }
    },
    {
        pattern: /^show\s*(\d+)\s*breakdown(s)?$/i,
        replace: (match) => {
            const count = parseInt(match[1], 10);
            let word = "разбивок";
            if (count % 10 === 1 && count % 100 !== 11) {
                word = "разбивку";
            } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
                word = "разбивки";
            }
            return `Показать ${count} ${word}`;
        }
    },
    {
        pattern: /^skills\s*\((\d+)\)$/i,
        replace: (match) => `Навыки (${match[1]})`
    },
    {
        pattern: /^rules\s*\((\d+)\)$/i,
        replace: (match) => `Правила (${match[1]})`
    },
    {
        pattern: /^mcp\s+tools\s*\((\d+)\)$/i,
        replace: (match) => `Инструменты MCP (${match[1]})`
    },
    {
        pattern: /^.*?(?:([\d.,]+)%\s*)?of\s+the\s+customization\s+budget\s+is\s+available\.?$/i,
        replace: (match) => {
            if (match[1]) {
                return `Доступно ${match[1]}% бюджета кастомизаций.`;
            }
            return "бюджета кастомизаций доступно.";
        }
    },
    {
        pattern: /^rules\s*\(([\d.]+)%\)\s*([\d\s]+)?$/i,
        replace: (match) => `Правила (${match[1]}%)${match[2] ? ' ' + match[2] : ''}`
    },
    {
        pattern: /^skills\s*\(([\d.]+)%\)\s*([\d\s]+)?$/i,
        replace: (match) => `Навыки (${match[1]}%)${match[2] ? ' ' + match[2] : ''}`
    },
    {
        pattern: /^mcp tools\s*\(([\d.]+)%\)\s*([\d\s]+)?$/i,
        replace: (match) => `Инструменты MCP (${match[1]}%)${match[2] ? ' ' + match[2] : ''}`
    },
    {
        pattern: /^your plan:\s*(.*)$/i,
        replace: (match) => `Ваш тариф: ${match[1]}`
    },
    {
        pattern: /^see\s*less$/i,
        replace: () => "Скрыть"
    },
    {
        pattern: /^you\s+have\s+used\s+some\s+of\s+your\s+weekly\s+limit,\s*it\s+will\s+fully\s+refresh\s+in\s*(.*)$/i,
        replace: (match) => {
            const time = translateDuration(match[1].replace(/\.$/, ''));
            return `Вы использовали часть недельного лимита, он полностью восстановится через ${time}.`;
        }
    },
    {
        pattern: /^you\s+have\s+used\s+some\s+of\s+your\s+5-hour\s+limit,\s*it\s+will\s+fully\s+refresh\s+in\s*(.*)$/i,
        replace: (match) => {
            const time = translateDuration(match[1].replace(/\.$/, ''));
            return `Вы использовали часть 5-часового лимита, он полностью восстановится через ${time}.`;
        }
    },
    {
        pattern: /^yes,\s*and\s*always\s*allow\s*'(.*?)'\s*when\s*not\s*in\s*a\s*project$/i,
        replace: (match) => `Да, и всегда разрешать '${match[1]}' вне проекта`
    },
    {
        pattern: /^yes,\s*and\s*always\s*allow\s*'(.*?)'$/i,
        replace: (match) => `Да, и всегда разрешать '${match[1]}'`
    },
    {
        pattern: /^(\d+)\s+tools\s+enabled$/i,
        replace: (match) => {
            const count = parseInt(match[1], 10);
            let word = "инструментов";
            if (count % 10 === 1 && count % 100 !== 11) {
                word = "инструмент";
            } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
                word = "инструмента";
            }
            return `Включено ${count} ${word}`;
        }
    },
    {
        pattern: /^send\s+feedback\s+as\s+(.*)$/i,
        replace: (match) => `Отправить отзыв от имени ${match[1]}`
    },
    // MCP View Translations
    {
        pattern: /^add\s+mcp\s*$/i,
        replace: (match) => `Добавить MCP`
    },
    {
        pattern: /^add\s+mcp\s*\+?\s*$/i,
        replace: (match) => `Добавить MCP +`
    },
    {
        pattern: /^(?:[\s←]*)(add\s+mcp\s+servers)(?:\s*)$/i,
        replace: (match) => {
            const hasArrow = match[0].includes('←');
            return (hasArrow ? '← ' : '') + 'Добавить MCP-серверы';
        }
    },
    // 36 MCP Server Descriptions
    {
        pattern: /^Query your GitLab SDLC as a knowledge graph.*/i,
        replace: () => `Запросы к вашему GitLab SDLC в виде графа знаний. Orbit индексирует группы, проекты, исходный код, запросы на слияние, пайплайны, рабочие элементы и результаты безопасности в единый граф...`
    },
    {
        pattern: /^Enable Antigravity to deploy apps to Google Cloud Run.*/i,
        replace: () => `Позволяет Antigravity развертывать приложения в Google Cloud Run.`
    },
    {
        pattern: /^Interact directly with the PostHog product analytics platform.*/i,
        replace: () => `Взаимодействуйте напрямую с платформой продуктовой аналитики PostHog на естественном языке. Запускайте запросы, управляйте флагами функций, отслеживайте ошибки и управляйте проектами.`
    },
    {
        pattern: /^Enable Antigravity to interact with Google Kubernetes Engine.*/i,
        replace: () => `Позволяет Antigravity взаимодействовать с Google Kubernetes Engine (GKE).`
    },
    {
        pattern: /^The Dart and Flutter MCP server exposes.*/i,
        replace: () => `MCP-сервер Dart и Flutter предоставляет действия инструментов разработки Dart (и Flutter) для совместимых клиентов AI-ассистентов.`
    },
    {
        pattern: /^The Firebase Model Context Protocol.*gives AI-powered.*/i,
        replace: () => `MCP-сервер Firebase дает инструментам разработки на базе ИИ возможность работать с вашими проектами Firebase и кодовой базой вашего приложения.`
    },
    {
        pattern: /^The Genkit Model Context Protocol.*gives AI-powered.*/i,
        replace: () => `MCP-сервер Genkit дает инструментам разработки на базе ИИ возможность собирать, отлаживать и инспектировать ваше приложение Genkit.`
    },
    {
        pattern: /^The gopls Model Context Protocol.*provides tools.*/i,
        replace: () => `MCP-сервер gopls предоставляет инструменты для семантического анализа кода, живой диагностики и преобразования вашей кодовой базы Go (не-google3).`
    },
    {
        pattern: /^Interact with your BigQuery data.*/i,
        replace: () => `Взаимодействуйте с вашими данными BigQuery на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашим наборам данных для поиска, проверки метаданных таблиц...`
    },
    {
        pattern: /^Interact with your AlloyDB for PostgreSQL data.*/i,
        replace: () => `Взаимодействуйте с вашими данными AlloyDB для PostgreSQL на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашей базе данных для выполнения SQL-запросов...`
    },
    {
        pattern: /^The Bigtable Admin remote MCP server.*/i,
        replace: () => `Удаленный MCP-сервер Bigtable Admin позволяет управлять ресурсами Bigtable.`
    },
    {
        pattern: /^The Spanner remote MCP server.*/i,
        replace: () => `Удаленный MCP-сервер Spanner позволяет получать доступ и запускать инструменты Spanner для создания, управления и выполнения запросов к ресурсам Spanner из вашей среды разработки с поддержкой ИИ...`
    },
    {
        pattern: /^Interact with your Cloud SQL for PostgreSQL data.*/i,
        replace: () => `Взаимодействуйте с вашими данными Cloud SQL для PostgreSQL на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашей базе данных для выполнения SQL-запросов...`
    },
    {
        pattern: /^Interact with your Cloud SQL for MySQL data.*/i,
        replace: () => `Взаимодействуйте с вашими данными Cloud SQL для MySQL на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашей базе данных для выполнения SQL-запросов, проверки...`
    },
    {
        pattern: /^Interact with your Cloud SQL for SQL Server data.*/i,
        replace: () => `Взаимодействуйте с вашими данными Cloud SQL для SQL Server на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашей базе данных для выполнения SQL-запросов...`
    },
    {
        pattern: /^Connect your AI assistants to Looker.*/i,
        replace: () => `Подключите ваших ИИ-ассистентов к бизнес-аналитике Looker. Этот MCP-сервер позволяет исследовать данные и управлять контентом, выполняя естественные...`
    },
    {
        pattern: /^Connect your AI assistants to the Knowledge Catalog.*/i,
        replace: () => `Подключите ваших ИИ-ассистентов к Каталогу знаний (ранее известному как Dataplex). Этот MCP-сервер позволяет находить данные и управлять ими, выполняя поиск...`
    },
    {
        pattern: /^The MCP Toolbox for Databases is.*/i,
        replace: () => `MCP Toolbox для баз данных — это MCP-сервер с открытым исходным кодом, созданный для упрощения и обеспечения безопасности разработки инструментов взаимодействия с базами данных.`
    },
    {
        pattern: /^AlloyDB for PostgreSQL Admin MCP Server enables.*/i,
        replace: () => `MCP-сервер AlloyDB для PostgreSQL Admin позволяет ИИ-ассистентам взаимодействовать с ресурсами AlloyDB для PostgreSQL, включая создание кластеров и администрирование пользователей.`
    },
    {
        pattern: /^Cloud SQL for PostgreSQL Admin MCP Server enables.*/i,
        replace: () => `MCP-сервер Cloud SQL для PostgreSQL Admin позволяет ИИ-ассистентам взаимодействовать с ресурсами Cloud SQL для PostgreSQL, включая создание инстансов, администрирование...`
    },
    {
        pattern: /^Cloud SQL for MySQL Admin MCP Server enables.*/i,
        replace: () => `MCP-сервер Cloud SQL для MySQL Admin позволяет ИИ-ассистентам взаимодействовать с ресурсами Cloud SQL для MySQL, включая создание инстансов, администрирование пользователей и...`
    },
    {
        pattern: /^Cloud SQL for SQL Server Admin MCP Server enables.*/i,
        replace: () => `MCP-сервер Cloud SQL для SQL Server Admin позволяет ИИ-ассистентам взаимодействовать с ресурсами Cloud SQL для SQL Server, включая создание инстансов, администрирование...`
    },
    {
        pattern: /^Interact with your Oracle Database data.*/i,
        replace: () => `Взаимодействуйте с вашими данными Oracle Database на естественном языке. Этот MCP-сервер позволяет безопасно подключаться к вашим базам данных для выполнения SQL-запросов...`
    },
    {
        pattern: /^The Dev Mode MCP Server brings Figma.*/i,
        replace: () => `MCP-сервер Dev Mode переносит Figma напрямую в ваш рабочий процесс, предоставляя важную информацию о дизайне и контекст ИИ-агентам, генерирующим код из Figma...`
    },
    {
        pattern: /^The GitHub MCP Server is.*/i,
        replace: () => `MCP-сервер GitHub — это сервер Model Context Protocol, обеспечивающий бесшовную интеграцию с API GitHub, что делает возможным продвинутую автоматизацию и взаимодействие...`
    },
    {
        pattern: /^Neon MCP Server is an open-source.*/i,
        replace: () => `MCP-сервер Neon — это инструмент с открытым исходным кодом, который позволяет вам взаимодействовать с базами данных Neon Postgres на естественном языке.`
    },
    {
        pattern: /^The Stripe Model Context Protocol server.*/i,
        replace: () => `MCP-сервер Stripe позволяет интегрироваться с API Stripe посредством вызова функций. Этот протокол поддерживает различные инструменты для взаимодействия с...`
    },
    {
        pattern: /^Interact with Redis key-value.*/i,
        replace: () => `Взаимодействуйте с хранилищами ключ-значение Redis`
    },
    {
        pattern: /^A Model Context Protocol server for interacting with MongoDB.*/i,
        replace: () => `Сервер Model Context Protocol для взаимодействия с MongoDB Atlas.`
    },
    {
        pattern: /^Official Notion MCP Server.*/i,
        replace: () => `Официальный MCP-сервер Notion, позволяющий взаимодействовать с рабочими пространствами, страницами, базами данных и комментариями Notion через Notion API.`
    },
    {
        pattern: /^Official Linear\.app MCP Server.*/i,
        replace: () => `Официальный MCP-сервер Linear.app для взаимодействия с проектами, задачами и рабочими процессами Linear.`
    },
    {
        pattern: /^An MCP server implementation that integrates the Perplexity.*/i,
        replace: () => `Реализация MCP-сервера, которая интегрирует Perplexity Sonar API для предоставления возможностей поиска в реальном времени по всей сети.`
    },
    {
        pattern: /^Official PayPal MCP Server.*/i,
        replace: () => `Официальный MCP-сервер PayPal, позволяющий интегрироваться с API PayPal для обработки платежей, управления транзакциями и операций с аккаунтами.`
    },
    {
        pattern: /^The Heroku Platform MCP Server enables.*/i,
        replace: () => `MCP-сервер Heroku Platform обеспечивает бесшовное взаимодействие с ресурсами Heroku Platform, позволяя LLM читать, управлять и оперировать приложениями, аддонами...`
    },
    {
        pattern: /^The Pinecone MCP Server enables.*/i,
        replace: () => `MCP-сервер Pinecone позволяет инструментам ИИ искать в документации Pinecone, настраивать индексы, генерировать код на основе конфигурации ваших индексов и...`
    },
    {
        pattern: /^Connect your Supabase projects to.*/i,
        replace: () => `Подключите ваши проекты Supabase к ИИ-ассистентам. Этот MCP-сервер позволяет управлять таблицами, получать конфигурацию, выполнять SQL-запросы, управлять edge-функциями и работать...`
    },
    {
        pattern: /^The Prisma MCP Server enables.*/i,
        replace: () => `MCP-сервер Prisma позволяет ИИ-инструментам легко взаимодействовать с Prisma для создания и управления базами данных Postgres.`
    },
    {
        pattern: /^The Locofy MCP Server enables.*/i,
        replace: () => `MCP-сервер Locofy позволяет интегрировать и расширять код Locofy.ai в вашей IDE.`
    },
    {
        pattern: /^Airweave lets agents.*/i,
        replace: () => `Airweave позволяет агентам искать в любом приложении.`
    },
    {
        pattern: /^Atlassian MCP Server for.*/i,
        replace: () => `MCP-сервер Atlassian для взаимодействия с продуктами Atlassian.`
    },
    {
        pattern: /^Harness MCP Server allows.*/i,
        replace: () => `MCP-сервер Harness позволяет ИИ-ассистентам взаимодействовать с API платформы Harness, обеспечивая интеллектуальную автоматизацию и помощь в доставке ПО и облачных...`
    },
    {
        pattern: /^SonarQube MCP Server enables.*/i,
        replace: () => `MCP-сервер SonarQube позволяет ИИ-ассистентам взаимодействовать с инстансами SonarQube для анализа качества кода, управления проектами и работы с воротами качества.`
    },
    {
        pattern: /^Netlify MCP Server enables.*/i,
        replace: () => `MCP-сервер Netlify позволяет ИИ-ассистентам взаимодействовать с платформой Netlify для управления сайтами, деплоями, доменами и другими процессами веб-разработки.`
    },
    {
        pattern: /^A Model Context Protocol server that provides structured thinking.*/i,
        replace: () => `Сервер Model Context Protocol, предоставляющий возможности структурированного мышления и рассуждения для диалогов с LLM.`
    },
    {
        pattern: /^Sonatype MCP server for.*/i,
        replace: () => `MCP-сервер Sonatype для взаимодействия с нашей платформой управления зависимостями и анализа безопасности.`
    },
    {
        pattern: /^The Google Maps Platform Code Assist.*/i,
        replace: () => `MCP-сервер Google Maps Platform Code Assist предоставляет вашему любимому ИИ-ассистенту актуальную официальную документацию и код Google Maps Platform...`
    },
    {
        pattern: /^This MCP server provides your LLM with docs.*/i,
        replace: () => `Этот MCP-сервер предоставляет вашей LLM документацию и примеры для инструментирования ИИ-приложений с помощью Arize AX, а также доступ к поддержке Arize. Подключите его к вашей IDE...`
    },
    {
        pattern: /^The Postman MCP Server connects.*/i,
        replace: () => `MCP-сервер Postman подключает Postman к ИИ-инструментам, предоставляя ИИ-агентам и ассистентам возможность доступа к рабочим пространствам, управления коллекциями и окружениями...`
    },
    {
        pattern: /^The Stitch MCP server enables.*/i,
        replace: () => `MCP-сервер Stitch позволяет ИИ-ассистентам взаимодействовать со Stitch для проектирования интерфейсов: генерации дизайнов из текста и изображений, доступа к деталям проектов и экранов...`
    },
    {
        pattern: /^The Google Developer Knowledge MCP server.*/i,
        replace: () => `MCP-сервер Google Developer Knowledge дает инструментам разработки на базе ИИ возможность искать и извлекать данные из официальной документации Google для разработчиков...`
    },
    {
        pattern: /^The ClickHouse MCP server enables.*/i,
        replace: () => `MCP-сервер ClickHouse позволяет агентам безопасно взаимодействовать с базами данных ClickHouse. Он предоставляет универсальный интерфейс для выполнения SQL, исследования данных...`
    },
    {
        pattern: /^Perform a range of infrastructure management tasks.*/i,
        replace: () => `Выполняйте широкий спектр задач по управлению инфраструктурой, включая: управление инстансами виртуальных машин (ВМ), управление группами инстансов и шаблонами...`
    },
    {
        pattern: /^Access enterprise mobility data using.*/i,
        replace: () => `Доступ к корпоративным данным мобильности с использованием запросов на естественном языке об устройствах, автоматического аудита соответствия политикам и интеграции...`
    },
    {
        pattern: /^Search your Google Cloud projects.*/i,
        replace: () => `Поиск по вашим проектам Google Cloud с использованием естественного языка.`
    },
    {
        pattern: /^Perform searches on ingested data.*/i,
        replace: () => `Выполняйте поиск по загруженным данным в хранилищах данных Google.`
    },
    {
        pattern: /^Interact with documents stored in a Firestore.*/i,
        replace: () => `Взаимодействуйте с документами, хранящимися в базе данных Firestore, используя естественный язык.`
    },
    {
        pattern: /^Access resources in the Cloud Logging.*/i,
        replace: () => `Доступ к ресурсам платформы Cloud Logging с использованием естественного языка.`
    },
    {
        pattern: /^Manage clusters for Managed Service for Apache Kafka.*/i,
        replace: () => `Управляйте кластерами Managed Service для Apache Kafka и Kafka Connect с использованием естественного языка.`
    },
    {
        pattern: /^Access resources in the Cloud Monitoring.*/i,
        replace: () => `Доступ к ресурсам платформы Cloud Monitoring с использованием естественного языка.`
    },
    {
        pattern: /^Manage Pub\/Sub resources and publish messages.*/i,
        replace: () => `Управляйте ресурсами Pub/Sub и публикуйте сообщения. Создавайте, просматривайте, получайте, обновляйте и удаляйте топики, подписки и снимки Pub/Sub, а также публикуйте сообщения.`
    },
    {
        pattern: /^The Cloud SQL remote MCP server.*/i,
        replace: () => `Удаленный MCP-сервер Cloud SQL позволяет получать доступ и запускать инструменты Cloud SQL для создания, управления и выполнения запросов к ресурсам Cloud SQL из вашей среды разработки...`
    },
    {
        pattern: /^Enable Antigravity to control and inspect a live Chrome.*/i,
        replace: () => `Позволяет Antigravity управлять и инспектировать запущенный браузер Chrome с доступом ко всей мощи Chrome DevTools для надежной автоматизации, глубокой отладки и...`
    }
];

let translationObserver = null;
let isTranslating = false;

function shouldIgnore(node) {
    let parent = node.parentElement;
    let insideSoftIgnore = false;
    
    while (parent) {
        const tagName = parent.tagName;
        const className = parent.className || '';
        const isStringClass = typeof className === 'string';
        const lowerClass = isStringClass ? className.toLowerCase() : '';
        
        // 1. Абсолютный игнор (Hard Ignore) — элементы редактора кода, логов, терминала
        if (
            tagName === 'PRE' || 
            tagName === 'CODE' || 
            tagName === 'TEXTAREA' || 
            tagName === 'INPUT' || 
            tagName === 'SCRIPT' || 
            tagName === 'STYLE' || 
            parent.contentEditable === 'true' ||
            (isStringClass && (
                lowerClass.includes('monaco-editor') || 
                lowerClass.includes('view-lines') || 
                lowerClass.includes('margin') || 
                lowerClass.includes('minimap') || 
                lowerClass.includes('terminal-container') || 
                lowerClass.includes('xterm') ||
                lowerClass.includes('terminal')
            ))
        ) {
            return true;
        }
        
        // 2. Мягкий игнор (Soft Ignore) — чат, markdown-блоки, вывод сообщений
        if (isStringClass && (
            lowerClass.includes('message-content') || 
            lowerClass.includes('message-text') ||
            lowerClass.includes('chat-output') ||
            lowerClass.includes('markdown-body')
        )) {
            insideSoftIgnore = true;
        }
        
        // 3. Явное исключение для интерактивных элементов внутри мягкого игнора.
        // Если мы встретили кнопку, плейсхолдер или ссылку, мы можем разрешить их перевод,
        // даже если они внутри чата. Но только если мы еще не наткнулись на Monaco Editor (который проверяется выше).
        if (tagName === 'BUTTON' || parent.getAttribute('role') === 'button' || tagName === 'A') {
            return false;
        }
        
        parent = parent.parentElement;
    }
    
    return insideSoftIgnore;
}

function isFileName(text, parent) {
    if (!text) return false;
    const trimmed = text.trim();
    
    // 1. Проверяем наличие расширения файла на конце (например, .md, .js, .json, .png, .txt, .py, .asar, .ps1)
    if (/\.[a-zA-Z0-9]{1,5}$/.test(trimmed)) {
        return true;
    }
    
    // 2. Проверяем наличие путей к файлам (содержат слэши, исключая простые даты)
    const hasPathChar = trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:\\/.test(trimmed) || trimmed.startsWith('file://');
    if ((trimmed.includes('/') || trimmed.includes('\\')) && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(trimmed)) {
        if (trimmed.includes(' ') && !hasPathChar) {
            return false;
        }
        return true;
    }
    
    // 3. Проверяем родительские классы
    let current = parent;
    while (current) {
        if (current.nodeType === Node.ELEMENT_NODE) {
            const className = current.className || '';
            if (typeof className === 'string') {
                const lowerClass = className.toLowerCase();
                if (
                    lowerClass.includes('file-name') ||
                    lowerClass.includes('filename') ||
                    lowerClass.includes('filepath') ||
                    lowerClass.includes('file-path') ||
                    lowerClass.includes('artifact-name') ||
                    lowerClass.includes('artifact-title') ||
                    lowerClass.includes('artifact-filename') ||
                    lowerClass.includes('artifact-header') ||
                    lowerClass.includes('file-info')
                ) {
                    return true;
                }
            }
        }
        current = current.parentElement;
    }
    
    return false;
}

function translateTextNode(node) {
    try {
        if (node.nodeType !== Node.TEXT_NODE) return;
        const text = node.nodeValue;
        const normalized = text.replace(/[\s\u00a0\xa0\u2007\u202f\r\n\t]+/g, ' ').trim();
        if (!normalized) return;
        
        if (isFileName(normalized, node.parentElement)) return;
        
        const lowerText = normalized.toLowerCase();
        let translated = null;
        
        if (translationDictionary[lowerText]) {
            translated = translationDictionary[lowerText];
        } else {
            for (const rule of regexTranslations) {
                const match = normalized.match(rule.pattern);
                if (match) {
                    translated = rule.replace(match);
                    break;
                }
            }
        }
        
        if (translated) {
            if (shouldIgnore(node)) return;
            
            const parent = node.parentElement;
            if (parent) {
                if (normalizeText(node.nodeValue) === translated) {
                    return;
                }
                
                parent.setAttribute('data-translated', 'true');
                parent.setAttribute('data-original-text', text);
                parent.setAttribute('title', `Original: ${text}`);
            }
            
            const match = node.nodeValue.match(/^(\s*)(.*?)(\s*)$/);
            if (match) {
                const leadingSpaces = match[1];
                const trailingSpaces = match[3];
                node.nodeValue = leadingSpaces + translated + trailingSpaces;
            } else {
                node.nodeValue = translated;
            }
        }
    } catch (e) {
        console.error('Error in translateTextNode:', e);
    }
}

function translatePlaceholder(element) {
    try {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || !element.getAttribute) return;
        if (shouldIgnore(element)) return;
        if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') return;
        const placeholder = element.getAttribute('placeholder');
        if (!placeholder) return;
        
        const normalized = normalizeText(placeholder);
        const lowerPlaceholder = normalized.toLowerCase();
        
        if (translationDictionary[lowerPlaceholder]) {
            const translatedValue = translationDictionary[lowerPlaceholder];
            if (element.getAttribute('placeholder') === translatedValue) return;
            
            element.setAttribute('data-translated-placeholder', 'true');
            element.setAttribute('data-original-placeholder', placeholder);
            element.setAttribute('placeholder', translatedValue);
        }
    } catch (e) {
        console.error('Error in translatePlaceholder:', e);
    }
}

function translateTitle(element) {
    try {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || !element.getAttribute) return;
        if (shouldIgnore(element)) return;
        
        const title = element.getAttribute('title');
        if (title && typeof title === 'string') {
            const normalized = normalizeText(title);
            const lowerTitle = normalized.toLowerCase();
            
            let translated = null;
            if (translationDictionary[lowerTitle]) {
                translated = translationDictionary[lowerTitle];
            } else {
                for (const rule of regexTranslations) {
                    const match = normalized.match(rule.pattern);
                    if (match) {
                        translated = rule.replace(match);
                        break;
                    }
                }
            }
            
            if (translated) {
                if (element.getAttribute('title') === translated) return;
                element.setAttribute('data-translated-title', 'true');
                element.setAttribute('data-original-title', title);
                element.setAttribute('title', translated);
            }
        }

        const tooltip = element.getAttribute('data-tooltip');
        if (tooltip && typeof tooltip === 'string') {
            const normalized = normalizeText(tooltip);
            const lowerTooltip = normalized.toLowerCase();
            
            let translated = null;
            if (translationDictionary[lowerTooltip]) {
                translated = translationDictionary[lowerTooltip];
            } else {
                for (const rule of regexTranslations) {
                    const match = normalized.match(rule.pattern);
                    if (match) {
                        translated = rule.replace(match);
                        break;
                    }
                }
            }
            
            if (translated) {
                if (element.getAttribute('data-tooltip') === translated) return;
                element.setAttribute('data-translated-tooltip', 'true');
                element.setAttribute('data-original-tooltip', tooltip);
                element.setAttribute('data-tooltip', translated);
            }
        }
    } catch (e) {
        console.error('Error in translateTitle:', e);
    }
}

function translateTree(root) {
    if (isTranslating) return;
    isTranslating = true;
    
    try {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            translateTextNode(node);
        }
        
        if (root.nodeType === Node.ELEMENT_NODE) {
            if (root.tagName === 'INPUT' || root.tagName === 'TEXTAREA') {
                translatePlaceholder(root);
            }
            translateTitle(root);
            
            if (root.querySelectorAll) {
                const inputs = root.querySelectorAll('input, textarea');
                inputs.forEach(translatePlaceholder);
                
                const allElements = root.querySelectorAll('*');
                allElements.forEach(translateTitle);
            }
        }
    } catch (e) {
        console.error('Error in translateTree:', e);
    } finally {
        isTranslating = false;
    }
}

function restoreOriginalTree() {
    isTranslating = true;
    
    try {
        const elements = document.querySelectorAll('[data-translated="true"]');
        elements.forEach(el => {
            const originalText = el.getAttribute('data-original-text');
            if (originalText) {
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while (node = walker.nextNode()) {
                    const trimmedValue = node.nodeValue.trim();
                    const lowerOriginal = originalText.toLowerCase();
                    let isMatch = false;
                    
                    if (translationDictionary[lowerOriginal] && (trimmedValue === translationDictionary[lowerOriginal] || translationDictionary[lowerOriginal] === trimmedValue)) {
                        isMatch = true;
                    } else {
                        for (const rule of regexTranslations) {
                            const match = originalText.match(rule.pattern);
                            if (match) {
                                const expectedTranslation = rule.replace(match);
                                if (trimmedValue === expectedTranslation) {
                                    isMatch = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (isMatch) {
                        const match = node.nodeValue.match(/^(\s*)(.*?)(\s*)$/);
                        const leadingSpaces = match ? match[1] : '';
                        const trailingSpaces = match ? match[3] : '';
                        node.nodeValue = leadingSpaces + originalText + trailingSpaces;
                        break;
                    }
                }
            }
            el.removeAttribute('data-translated');
            el.removeAttribute('data-original-text');
            el.removeAttribute('title');
        });
        
        const inputs = document.querySelectorAll('[data-translated-placeholder="true"]');
        inputs.forEach(el => {
            const originalPlaceholder = el.getAttribute('data-original-placeholder');
            if (originalPlaceholder) {
                el.setAttribute('placeholder', originalPlaceholder);
            }
            el.removeAttribute('data-translated-placeholder');
            el.removeAttribute('data-original-placeholder');
        });

        const titles = document.querySelectorAll('[data-translated-title="true"]');
        titles.forEach(el => {
            const originalTitle = el.getAttribute('data-original-title');
            if (originalTitle) {
                el.setAttribute('title', originalTitle);
            }
            el.removeAttribute('data-translated-title');
            el.removeAttribute('data-original-title');
        });

        const tooltips = document.querySelectorAll('[data-translated-tooltip="true"]');
        tooltips.forEach(el => {
            const originalTooltip = el.getAttribute('data-original-tooltip');
            if (originalTooltip) {
                el.setAttribute('data-tooltip', originalTooltip);
            }
            el.removeAttribute('data-translated-tooltip');
            el.removeAttribute('data-original-tooltip');
        });
    } catch (e) {
        console.error('Error in restoreOriginalTree:', e);
    } finally {
        isTranslating = false;
    }
}

function startObserving() {
    if (translationObserver) return;
    
    try {
        translationObserver = new MutationObserver((mutations) => {
            if (isTranslating) return;
            
            // Временно отключаем наблюдение, чтобы избежать бесконечного цикла из собственных изменений
            stopObserving();
            isTranslating = true;
            
            try {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes') {
                        const target = mutation.target;
                        if (target.nodeType === Node.ELEMENT_NODE) {
                            if (mutation.attributeName === 'placeholder') {
                                translatePlaceholder(target);
                            } else if (mutation.attributeName === 'title' || mutation.attributeName === 'data-tooltip') {
                                translateTitle(target);
                            }
                        }
                    } else {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                translateTree(node);
                            } else if (node.nodeType === Node.TEXT_NODE) {
                                translateTextNode(node);
                            }
                        });
                        if (mutation.type === 'characterData') {
                            translateTextNode(mutation.target);
                        }
                    }
                });
            } catch (e) {
                console.error('Error in MutationObserver loop:', e);
            } finally {
                isTranslating = false;
                startObserving();
            }
        });
        
        translationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['title', 'data-tooltip', 'placeholder']
        });
    } catch (e) {
        console.error('Error in startObserving:', e);
    }
}

function stopObserving() {
    if (translationObserver) {
        translationObserver.disconnect();
        translationObserver = null;
    }
}

function initLanguageSwitcher() {
    const existingSwitcher = document.getElementById('antigravity-lang-switcher');
    if (existingSwitcher) {
        existingSwitcher.remove();
    }
    const existingStyle = document.getElementById('antigravity-lang-switcher-style');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const container = document.createElement('div');
    container.id = 'antigravity-lang-switcher';
    container.className = 'lang-switcher';
    container.innerHTML = `
        <div class="lang-btn" id="lang-btn-en">EN</div>
        <div class="lang-btn" id="lang-btn-ru">RU</div>
    `;
    
    const style = document.createElement('style');
    style.id = 'antigravity-lang-switcher-style';
    style.innerHTML = `
        .lang-switcher {
            position: fixed;
            top: 5px;
            right: 180px;
            z-index: 999999;
            display: flex;
            background: #202124;
            border: 1px solid #3c4043;
            border-radius: 4px;
            padding: 2px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 10px;
            color: #bdc1c6;
            -webkit-app-region: no-drag;
            user-select: none;
        }
        [data-theme="light"] .lang-switcher {
            background: #f1f3f4;
            border: 1px solid #dadce0;
            color: #5f6368;
        }
        .lang-btn {
            padding: 1px 6px;
            border-radius: 2px;
            cursor: pointer;
            transition: all 0.1s ease;
        }
        .lang-btn.active {
            background: #3c4043;
            color: #ffffff;
            font-weight: bold;
        }
        [data-theme="light"] .lang-btn.active {
            background: #ffffff;
            color: #202124;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .lang-btn:hover:not(.active) {
            background: rgba(255, 255, 255, 0.05);
        }
        [data-theme="light"] .lang-btn:hover:not(.active) {
            background: rgba(0, 0, 0, 0.05);
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);
    
    const btnEn = document.getElementById('lang-btn-en');
    const btnRu = document.getElementById('lang-btn-ru');
    
    let currentLang = localStorage.getItem('antigravity_lang') || 'ru';
    
    function updateUI() {
        if (currentLang === 'ru') {
            btnRu.classList.add('active');
            btnEn.classList.remove('active');
            startObserving();
            translateTree(document.body);
        } else {
            btnEn.classList.add('active');
            btnRu.classList.remove('active');
            stopObserving();
            restoreOriginalTree();
        }
    }
    
    btnEn.addEventListener('click', () => {
        currentLang = 'en';
        localStorage.setItem('antigravity_lang', 'en');
        updateUI();
    });
    
    btnRu.addEventListener('click', () => {
        currentLang = 'ru';
        localStorage.setItem('antigravity_lang', 'ru');
        updateUI();
    });
    
    updateUI();
}

function initTerminalInjection() {
    try {
        if (window.__antigravity_terminal_injected) return;
        window.__antigravity_terminal_injected = true;
        
        console.log("[Antigravity Term Injection] Initializing terminal WebSocket hook...");
        
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            const ws = new OriginalWebSocket(url, protocols);
            
            const urlStr = String(url);
            // Проверяем, является ли WebSocket терминальным
            if (urlStr.includes('/terminal') || urlStr.includes('/pty') || urlStr.includes('/shell') || urlStr.includes('/term')) {
                console.log("[Antigravity Term Injection] Terminal WebSocket connection detected:", urlStr);
                try {
                    localStorage.setItem('antigravity_terminal_status', 'WebSocket detected: ' + urlStr + ' at ' + new Date().toISOString());
                } catch(e) {}
                
                let hasSentCd = false;
                const originalSend = ws.send;
                
                ws.send = function(data) {
                    console.log("[Antigravity Term Debug] Terminal WebSocket sent data:", data);
                    
                    if (!hasSentCd) {
                        hasSentCd = true;
                        
                        // Задержка перед отправкой команды cd для инициализации shell
                        setTimeout(() => {
                            try {
                                // 1. Определяем путь к текущему проекту
                                let projectPath = null;
                                
                                // Ищем UUID проекта в URL
                                const urlMatch = window.location.href.match(/projects\/([a-f0-9\-]{36})/i) || 
                                                 window.location.hash.match(/projects\/([a-f0-9\-]{36})/i);
                                
                                if (urlMatch && window.__antigravity_projects_map) {
                                    const projectId = urlMatch[1];
                                    projectPath = window.__antigravity_projects_map[projectId];
                                    console.log(`[Antigravity Term Injection] Found project ID ${projectId} in URL. Target path: ${projectPath}`);
                                    try {
                                        localStorage.setItem('antigravity_terminal_status', 'Project ID found: ' + projectId + ' -> ' + projectPath);
                                    } catch(e) {}
                                }
                                
                                // Fallback: если проект не определен по URL, пробуем взять первый из карты проектов
                                if (!projectPath && window.__antigravity_projects_map) {
                                    const paths = Object.values(window.__antigravity_projects_map);
                                    if (paths.length > 0) {
                                        projectPath = paths[0];
                                    }
                                }
                                
                                // Крайний fallback
                                if (!projectPath) {
                                    projectPath = "C:\\Antigravity projects\\antigravity-features";
                                }
                                
                                const cdCommand = `cd "${projectPath}"\r`;
                                let sent = false;
                                
                                // 2. Пытаемся адаптироваться под формат данных (JSON или сырой текст)
                                if (typeof data === 'string') {
                                    const trimmed = data.trim();
                                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                        try {
                                            const parsed = JSON.parse(data);
                                            console.log("[Antigravity Term Debug] Parsed client message structure:", parsed);
                                            
                                            if (parsed.type) {
                                                originalSend.call(ws, JSON.stringify({ type: "input", data: cdCommand }));
                                                originalSend.call(ws, JSON.stringify({ type: "stdin", data: cdCommand }));
                                                sent = true;
                                            } else if (parsed.event) {
                                                originalSend.call(ws, JSON.stringify({ event: "input", data: cdCommand }));
                                                originalSend.call(ws, JSON.stringify({ event: "stdin", data: cdCommand }));
                                                sent = true;
                                            } else if (Array.isArray(parsed)) {
                                                originalSend.call(ws, JSON.stringify(["input", cdCommand]));
                                                originalSend.call(ws, JSON.stringify(["stdin", cdCommand]));
                                                originalSend.call(ws, JSON.stringify([0, cdCommand]));
                                                sent = true;
                                            }
                                        } catch (e) {
                                            console.error("[Antigravity Term Debug] Error parsing client JSON:", e);
                                        }
                                    }
                                }
                                
                                // Если не JSON или не подошел формат, отправляем сырой текст
                                if (!sent) {
                                    console.log("[Antigravity Term Debug] Sending raw cd command:", cdCommand.trim());
                                    originalSend.call(ws, cdCommand);
                                }
                                try {
                                    localStorage.setItem('antigravity_terminal_status', 'Command sent: ' + cdCommand.trim() + ' at ' + new Date().toISOString());
                                } catch(e) {}
                            } catch (err) {
                                console.error("[Antigravity Term Injection] Auto-cd execution failed:", err);
                            }
                        }, 800);
                    }
                    
                    return originalSend.apply(this, arguments);
                };
            }
            return ws;
        };
        
        // Восстанавливаем прототипы
        Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
        window.WebSocket.prototype = OriginalWebSocket.prototype;
        
    } catch (e) {
        console.error("[Antigravity Term Injection] Error initializing hook:", e);
    }
}

const initInterval = setInterval(() => {
    if (document.body && document.head) {
        clearInterval(initInterval);
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const isInternal = protocol === 'vscode-file:' || protocol === 'vscode-webview:' || protocol === 'antigravity-ide:' || hostname === '127.0.0.1' || hostname === 'localhost';
        if (isInternal) {
            initLanguageSwitcher();
            initTerminalInjection();
        }
    }
}, 50);

