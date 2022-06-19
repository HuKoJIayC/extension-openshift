/**
 * Реализованый функционал:
 * - Добавляет вкладку Resources вместо Operators и добавляет в неё часто используемые сущности Istio
 * - Добавляет возможность ввода текста для поиска без активации поля Search
 * - При загрузке страницы раскрывает Resources, Workloads, Networking
 * - Возможность удалять Pod с битых Nodes
 * - Возможность запуска bash для просмотра логов
 * - Возможность запуска bash для работы с терминалом
 * - Проверка при запуске, что есть возможность работы с теоретиком
 * - Готовые фильтры в Search для поиска маршрута, просмотра безопасности и т.п.
 * - Добавлены разделители в ресурсы
 * - Изменён порядок фильтров в более логичный
 * - Добавлен выпадающий список стендов для быстрого перехода
 * - Автоматически выбирается случайный проект с списке после перехода
 * - Добавлен автовход в рамках текущей сессии в браузере
 * - Добавлен цветной лог и возможность включения переноса текста
 */

/**
 * TODO LIST
 * - Добавить нормальные отступы в цветной лог
 * - При переключении в другой контейнер с включеным Original, лог загружается скрытым
 * - Хранить настройки в local storage
 * - Цвет для контейнера istio-proxy
 */


let project = null;
let username = null;
let kinds = [
    'core~v1~Endpoints',
    ,
    'networking.istio.io~v1alpha3~VirtualService',
    'networking.istio.io~v1alpha3~Gateway',
    'networking.istio.io~v1alpha3~EnvoyFilter',
    'networking.istio.io~v1alpha3~DestinationRule',
    'networking.istio.io~v1alpha3~ServiceEntry',
    ,
    'authentication.istio.io~v1alpha1~Policy',
    'security.istio.io~v1beta1~PeerAuthentication',
    'security.istio.io~v1beta1~AuthorizationPolicy'
];
let logContainerName = null;
let standList = [];


// Цикличный старт процессов
setInterval(run, 1000);
function run() {
    autoLoginWithCa();
    checkAutologin();
    let newProjectName = getProjectName();
    if (newProjectName != null) {
        let isChangedProjectName = (project != newProjectName);
        project = newProjectName;
        if (isChangedProjectName && document.querySelector('li[class*="aide"]') != null) {
            changeHrefKinds();
        }
    }
    if (document.querySelector('li[class*="aide"]') == null) {
        addedKinds();
    } else {
        removeFocus();
    }
    if (document.querySelector('span.co-username') != null) {
        username = document.querySelector('span.co-username').textContent;
    }
    getStandList();
    changedDisabledButtonPod();
    // checkToolbar();
    checkDropdownLiForResource();
    checkNamespaceBar();
    setTerminalColor();
    createLogWrapButton();
    autoSelectHorizontalLink();
    // hideTitle();
}

// Получение списка стендов
function getStandList() {
    if (standList.length == 0 && window.location.pathname.indexOf("/k8s/") == 0)
    browser.runtime.sendMessage({ type: 'get_stands', host: window.location.hostname }, function (result) {
        standList = result.stands;
    });
}

// function hideTitle() {
//     let div = document.querySelector('div.co-global-notification');
//     if (div == null || div.hidden == true) {
//         return;
//     }
//     let header = document.querySelector('div.pf-c-page__header-brand');
//     if (header != null) {
//         let divStandName = document.createElement('div');
//         divStandName.className = 'text-center';
//         divStandName.style.display = 'block';
//         divStandName.textContent = div.textContent;
//         header.after(divStandName);
//     }
//     div.hidden = true;
// }

// Выбрать yaml
function autoSelectHorizontalLink() {
    let breadcrumb = document.querySelector('a.pf-c-breadcrumb__link');
    if (breadcrumb == null || ['Secrets', 'ConfigMaps', 'Routes', 'Services'].includes(breadcrumb.textContent)) {
        return;
    }
    // logs
    let logButton = document.querySelector('a[data-test-id="horizontal-link-details-page~Logs"]');
    if (logButton != null) {
        if (logButton.classList.contains('was-selected')) {
            return;
        }
        logButton.classList.add('was-selected');
        logButton.click();
        return;
    }
    // yaml
    let yamlButton = document.querySelector('a[data-test-id="horizontal-link-details-page~YAML"]');
    if (yamlButton != null) {
        if (yamlButton.classList.contains('was-selected')) {
            return;
        }
        yamlButton.classList.add('was-selected');
        yamlButton.click();
        return;
    }
}

// Автовыбор ЦА при входе
function autoLoginWithCa() {
    let button = document.querySelector('a.pf-c-button[title="Log in with ca"]');
    if (button == null || document.querySelector('h1.pf-c-title') == null) {
        return;
    }
    button.click();
}

// Создание терминала с перекрашенным логом
function setTerminalColor() {
    let logLinesDiv = document.querySelector('div[class="log-window__lines"]');
    let logContentsDiv = document.querySelector('div[class="log-window__contents"]');
    if (logLinesDiv == null || logContentsDiv == null) {
        logContainerName = null;
        return;
    }
    let logColorLinesDiv = document.querySelector('div[class="log-window__color_lines"]');
    if (logColorLinesDiv == null) {
        logColorLinesDiv = document.createElement('div');
        logColorLinesDiv.className = 'log-window__color_lines';
        logContentsDiv.appendChild(logColorLinesDiv);
    }
    let dropDownButton = document.querySelector('button.pf-c-dropdown__toggle[data-test-id="dropdown-button"]');
    if (dropDownButton == null) {
        return;
    }
    let containerButton = dropDownButton.querySelector('span.co-resource-item__resource-name');
    if (containerButton == null) {
        return;
    }
    if (containerButton.textContent != logContainerName) {
        logContainerName = containerButton.textContent;
        logColorLinesDiv.replaceChildren();
    }
    // Создание строк цветного лога
    let lines = logLinesDiv.textContent.split('\n');
    let colorLinesDiv = logColorLinesDiv.getElementsByTagName('div');
    if (lines.length < 1001 && lines.length == colorLinesDiv.length) {
        // Обновление не требуется (актуально)
        // setTimeout(setTerminalColor, 100);
        return;
    } else if (lines.length < 100) {
        // Обновление не требуется (загрузка)
        // setTimeout(setTerminalColor, 1000);
        return;
    } else if (colorLinesDiv.length == 0) {
        // Первое создание
        logLinesDiv.hidden = true;
        let currentColor = '#fff';
        for (let i = 0; i < lines.length - 1; i++) {
            let div = createColorLineDiv(lines[i], currentColor);
            currentColor = div.style.color;
            logColorLinesDiv.appendChild(div);
        }
    } else {
        // Обновление
        // Поиск крайних данных лога совпадением последних 10-ти строк
        let indexLastString = -1;
        for (let i = lines.length - 2; i >= 0; i--) {
            let isFound = false;
            for (let j = 0; j < 10; j++) {
                if (lines[i - j] != colorLinesDiv[colorLinesDiv.length - 1 - j].textContent.slice(1)) {
                    break;
                } else if (j == 9) {
                    isFound = true;
                }
            }
            if (isFound) {
                indexLastString = i;
                break;
            }
        }
        if (indexLastString == -1) {
            return;
        }
        // Отображение новых строк
        let currentColor = '#fff';
        for (let i = indexLastString + 1; i < lines.length - 1; i++) {
            let div = createColorLineDiv(lines[i], currentColor);
            currentColor = div.style.color;
            logColorLinesDiv.appendChild(div);
            div.focus();
        }
        // Скролл до крайнего элемента
        let logScrollDiv = document.querySelector('div[class="log-window__scroll-pane"]');
        let logState = document.querySelector('div.co-toolbar__item');
        if (logScrollDiv != null && logState != null && logState.textContent.indexOf('Log streaming...') == 0) {
            logScrollDiv.scrollTop = logScrollDiv.scrollHeight;
        }
    }
    // setTimeout(setTerminalColor, 100);
}

// Добавление кнопки переноса текста в логе
function createLogWrapButton() {
    let group = document.querySelector('div[class*=co-toolbar__group--right]');
    if (group == null || document.getElementById('wrap-button') != null) {
        return;
    }
    let span = document.createElement('span');
    span.className = 'co-action-divider hidden-xs';
    span.textContent = '|';
    span.setAttribute("aria-hidden", "true");
    group.children[0].before(span);
    let a = document.createElement('a');
    a.id = 'wrap-button';
    a.style.cursor = 'pointer';
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M370.72 133.28C339.458 104.008 298.888 87.962 255.848 88c-77.458.068-144.328 53.178-162.791 126.85-1.344 5.363-6.122 9.15-11.651 9.15H24.103c-7.498 0-13.194-6.807-11.807-14.176C33.933 94.924 134.813 8 256 8c66.448 0 126.791 26.136 171.315 68.685L463.03 40.97C478.149 25.851 504 36.559 504 57.941V192c0 13.255-10.745 24-24 24H345.941c-21.382 0-32.09-25.851-16.971-40.971l41.75-41.749zM32 296h134.059c21.382 0 32.09 25.851 16.971 40.971l-41.75 41.75c31.262 29.273 71.835 45.319 114.876 45.28 77.418-.07 144.315-53.144 162.787-126.849 1.344-5.363 6.122-9.15 11.651-9.15h57.304c7.498 0 13.194 6.807 11.807 14.176C478.067 417.076 377.187 504 256 504c-66.448 0-126.791-26.136-171.315-68.685L48.97 471.03C33.851 486.149 8 475.441 8 454.059V320c0-13.255 10.745-24 24-24z');
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'vertical-align: -0.125em;');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('height', '1em');
    svg.setAttribute('width', '1em');
    svg.setAttribute('viewBox', '0 0 512 512');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('role', 'img');
    svg.classList.add('co-icon-space-r');
    svg.appendChild(path);
    a.appendChild(svg);
    let spanLabel = document.createElement('span');
    spanLabel.textContent = 'No wrap';
    spanLabel.id = 'wrap-span';
    a.appendChild(spanLabel);
    // Функционал кнопки
    a.addEventListener('click', (event) => {
        let span = document.getElementById('wrap-span');
        let logLinesDiv = document.querySelector('div[class="log-window__lines"]');
        let logColorLinesDiv = document.querySelector('div[class="log-window__color_lines"]');
        if (logLinesDiv == null || logColorLinesDiv == null || span == null) {
            return;
        } else if (span.textContent == 'No wrap') {
            span.textContent = 'Original';
            logLinesDiv.hidden = false;
            logColorLinesDiv.hidden = true;
            return;
        } else if (span.textContent == 'Wrap') {
            span.textContent = 'No wrap';
        } else {
            span.textContent = 'Wrap';
        }
        logLinesDiv.hidden = true;
        logColorLinesDiv.hidden = false;
        let lines = document.querySelectorAll('div[class="log-line"]');
        for (let i = 0; i < lines.length; i++) {
            lines[i].style.display = (span.textContent != 'Wrap' ? "block ruby" : "block");
        }
    });
    group.children[0].before(a);
}

// Создание окрашной строки лога
function createColorLineDiv(line, currentColor) {
    let color = currentColor;
    let index = 100;
    // Получение цвета
    let indexTrace = line.indexOf('TRACE');
    if (indexTrace > -1 && indexTrace < index) {
        color = '#808080';
        index = indexTrace;
    }
    let indexDebug = line.indexOf('DEBUG');
    if (indexDebug > -1 && indexDebug < index) {
        color = '#808080';
        index = indexDebug;
    }
    let indexInfo = line.indexOf('INFO');
    if (indexInfo > -1 && indexInfo < index) {
        color = '#fff';
        index = indexInfo;
    }
    let indexWarn = line.indexOf('WARN');
    if (indexWarn > -1 && indexWarn < index) {
        color = '#ffac00';
        index = indexWarn;
    }
    let indexError = line.indexOf('ERROR');
    if (indexError > -1 && indexError < index) {
        color = '#df0d00';
        index = indexError;
    }
    // Создание элемента
    let div = document.createElement('div');
    div.style.color = color;
    div.style.display = "block ruby";
    div.className = 'log-line';
    if (line.indexOf(' ') == 0 || line.indexOf('  ') > -1) {
        line = line.replaceAll(' ', ' ');
    }
    div.textContent = " " + line;
    return div;
}

// Проверка на экран входа и добавление кнопки автовхода
function checkAutologin() {
    if (document.getElementById('inputUsername') == null
    || document.getElementById('inputPassword') == null
    || document.getElementById('inputAutologin') != null) {
        return;
    }
    if (document.querySelectorAll('div[class="pf-c-form__group"]').length != 2) {
        return;
    }
    // Добавление флага автовхода
    let input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'inputAutologin';
    input.checked = true;
    let span = document.createElement('span');
    span.appendChild(input);
    span.append(' Auto log in to last account');
    span.className = 'pf-c-form__label-text';
    let label = document.createElement('label');
    label.appendChild(span);
    label.setAttribute('for', 'inputAutologin');
    label.className = 'pf-c-form__label';
    let div = document.createElement('div');
    div.appendChild(label);
    div.className = 'pf-c-form__group';
    document.querySelectorAll('div[class="pf-c-form__group"]')[1].after(div);
    // Добавление дополнительного функционала на кнопку входа
    document.querySelector('button').addEventListener('click', (event) => {
        if (!document.getElementById('inputAutologin').checked) {
            browser.runtime.sendMessage({ type: 'clear_userdata' }, function (result) { });
            return;
        }
        browser.runtime.sendMessage({ type: 'set_userdata', username: document.getElementById('inputUsername').value, password: document.getElementById('inputPassword').value }, function (result) { });
    });
    // Заполнение пользовательских данных
    browser.runtime.sendMessage({ type: 'get_userdata' }, function (result) {
        input.checked = result.flag;
        if (result.username == '' || result.password == '') {
            return;
        }
        document.getElementById('inputUsername').focus();
        document.getElementById('inputUsername').value = result.username;
        document.getElementById('inputPassword').focus();
        document.getElementById('inputPassword').value = result.password;
        // Автовход, если не было ошибок
        let errorElement = document.querySelector('div[class="error-placeholder"]');
        if (errorElement != null && errorElement.innerText == '') {
            document.getElementById('inputUsername').style.backgroundColor = '#a7d1a7';
            document.getElementById('inputPassword').style.backgroundColor = '#a7d1a7';
            document.querySelector('button').focus();
            document.querySelector('button').click();
            // document.querySelector('form').submit();
            // sleep(2000).then(() => {
            //     document.querySelector('button').click();
            // });
        }
    });
}

// Проверка и добавление списка стендов
function checkNamespaceBar() {
    let divNsBar = document.querySelector('div[class="co-namespace-bar__items"]');
    let spanStandName = document.getElementById('stand-name');
    if (divNsBar == null || spanStandName != null || standList.length == 0) {
        return;
    }
    // Добавление названия стенда
    spanStandName = document.createElement('span');
    spanStandName.className = 'pf-c-dropdown__toggle-text';
    spanStandName.id = 'stand-name';
    spanStandName.innerText = 'Stand: ...';
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z');
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('pf-c-dropdown__toggle-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('height', '1em');
    svg.setAttribute('width', '1em');
    svg.setAttribute('style', 'vertical-align: -0.125em;');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('viewBox', '0 0 320 512');
    svg.setAttribute('role', 'img');
    svg.appendChild(path);
    let divBtn = document.createElement('div');
    divBtn.className = 'btn-dropdown__content-wrap';
    divBtn.appendChild(spanStandName);
    divBtn.appendChild(svg);
    let button = document.createElement('button');
    button.className = 'pf-c-dropdown__toggle pf-m-plain';
    button.setAttribute('aria-has-popup', 'true');
    button.type = 'button';
    button.appendChild(divBtn);
    button.addEventListener('click', (event) => {
        let ulStandList = document.getElementById('stand-list');
        if (ulStandList == null) {
            return;
        }
        if (ulStandList.style.display == 'none') {
            updateLiStandsDropdown();
            ulStandList.style.display = 'block';
        } else {
            ulStandList.style.display = 'none';
        }
    });
    let divDropDown = document.createElement('div');
    divDropDown.className = 'dropdown pf-c-dropdown';
    divDropDown.appendChild(button);
    let divSelector = document.createElement('div');
    divSelector.className = 'co-namespace-selector';
    divSelector.appendChild(divDropDown);
    divNsBar.appendChild(divSelector);
    // Добавление списка стендов
    let ul = document.createElement('ul');
    ul.id = 'stand-list';
    ul.style.display = 'none';
    ul.setAttribute('role', 'listbox');
    ul.className = 'pf-c-dropdown__menu co-namespace-selector__menu';
    for (let i = 0; i < standList.length; i++) {
        if (standList[i].host == window.location.hostname) {
            spanStandName.innerText = 'Stand: ' + standList[i].name;
        }
        let a = document.createElement('a');
        a.className = 'pf-c-dropdown__menu-item next-to-bookmark';
        a.href = window.location.protocol + '//' + standList[i].host + window.location.pathname.replace(project, '*');
        a.innerText = standList[i].name;
        let li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.appendChild(a);
        ul.appendChild(li);
    }
    ul.addEventListener('blur', (event) => {
        let ulStandList = document.getElementById('stand-list');
        if (ulStandList == null) {
            return;
        }
        ulStandList.style.display = 'none';
    }, true);
    divDropDown.appendChild(ul);
}

// 
function updateLiStandsDropdown() {
    let ulStandList = document.getElementById('stand-list');
    if (ulStandList == null) {
        return;
    }
    let children = document.getElementById('stand-list').children;
    for (let i = 0; i < children.length; i++) {
        if (children[i].children.length == 0) {
            continue;
        }
        let a = children[i].children[0];
        for (let j = 0; j < standList.length; j++) {
            if (a.innerText != standList[j].name) {
                continue;
            }
            a.href = window.location.protocol + '//' + standList[j].host + window.location.pathname.replace(project, '*');
        }
    }
}

// Проверка и добавление готовых фильтров в Search
function checkDropdownLiForResource() {
    if (document.querySelectorAll('.dropdown-menu__filter').length == 0
        || document.querySelector('input.pf-c-form-control[placeholder="Select Resource"]') == null
        || document.querySelector('input.pf-c-form-control[placeholder="Select Resource"]').value.length > 0) {
        return;
    }
    let listElem = [
        {
            name: 'Policies',
            tag: 'P',
            iconClass: 'co-m-resource-icon co-m-resource-alertmanager',
            link: '?kind=security.istio.io%7Ev1beta1%7EAuthorizationPolicy%2Cnetworking.istio.io%7Ev1beta1%7EDestinationRule%2Cauthentication.istio.io%7Ev1alpha1%7EPolicy'
        },
        {
            name: 'Istio',
            tag: 'I',
            iconClass: 'co-m-resource-icon co-m-resource-project',
            link: '?kind=networking.istio.io%7Ev1beta1%7EGateway%2Cnetworking.istio.io%7Ev1beta1%7EVirtualService%2Cnetworking.istio.io%7Ev1beta1%7EServiceEntry%2Cnetworking.istio.io%7Ev1beta1%7EDestinationRule%2Cnetworking.istio.io%7Ev1alpha3%7EEnvoyFilter'
        },
        {
            name: 'All',
            tag: 'A',
            iconClass: 'co-m-resource-icon co-m-resource-deploymentconfig',
            link: '?kind=networking.istio.io%7Ev1beta1%7EGateway%2Cnetworking.istio.io%7Ev1beta1%7EVirtualService%2Cnetworking.istio.io%7Ev1beta1%7EServiceEntry%2Cnetworking.istio.io%7Ev1beta1%7EDestinationRule%2Ccore%7Ev1%7EEndpoints%2Cnetworking.istio.io%7Ev1alpha3%7EEnvoyFilter%2Ccore%7Ev1%7EPod%2Capps%7Ev1%7EDeployment%2Ccore%7Ev1%7ESecret%2Ccore%7Ev1%7EConfigMap%2Ccore%7Ev1%7EService%2Croute.openshift.io%7Ev1%7ERoute'
        }
    ];
    for (let i = 0; i < listElem.length; i++) {
        if (document.getElementById('aide:v1:' + listElem[i].name) == null) {
            document.querySelector('.dropdown-menu__filter').after(createDropdownLiForResource(listElem[i].name, listElem[i].tag, listElem[i].iconClass, '/search/ns/' + project + listElem[i].link));
        }
    }
}

// Добавление фильтра в список Search
function createDropdownLiForResource(name, tag, iconClass, link) {
    // checkbox
    let input = document.createElement('input');
    input.className = 'pf-c-check__input';
    input.type = 'checkbox';
    input.tabIndex = '-1';
    input.id = 'aide:v1:' + name;
    input.setAttribute('aria-invalid', 'false');
    let div = document.createElement('div');
    div.className = 'pf-c-check';
    div.appendChild(input);
    // resource icon
    let spanSr = document.createElement('span');
    spanSr.className = 'sr-only';
    spanSr.innerText = name;
    let spanIcon = document.createElement('span');
    spanIcon.className = iconClass;
    spanIcon.title = name;
    spanIcon.innerText = tag.toUpperCase();
    let spanResource = document.createElement('span');
    spanResource.className = 'co-resource-icon--fixed-width';
    spanResource.appendChild(spanSr);
    spanResource.appendChild(spanIcon);
    // resource name
    let spanValue = document.createElement('span');
    spanValue.innerText = name;
    let spanName = document.createElement('span');
    spanName.className = 'co-resource-item__resource-name';
    spanName.appendChild(spanValue);
    // general
    let span = document.createElement('span');
    span.className = 'co-resource-item';
    span.appendChild(div);
    span.appendChild(spanResource);
    span.appendChild(spanName);
    let a = document.createElement('a');
    a.href = link;
    a.className = 'pf-c-dropdown__menu-item';
    a.id = 'aide~v1~' + name + '-link';
    a.setAttribute('data-test', 'dropdown-menu-item-link');
    a.appendChild(span);
    let li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.appendChild(a);
    return li;
}

// Перехват нажатий, кроме комбинаций с Ctrl
document.addEventListener('keydown', (event) => {
    // console.log(event.target.value, event.target.data);
    // console.log(document.activeElement.tagName);
    // console.log(event.code);
    // console.log(event.key);
    // console.log(event);
    if (!event.ctrlKey
        && (document.activeElement.tagName.toLowerCase() != 'input' || document.activeElement.id != "copytext")
        && document.activeElement.tagName.toLowerCase() != 'textarea'
        && event.key.length == 1) {
        // document.querySelectorAll('input')[0].value += event.key;
        document.querySelector('input[placeholder="Search by name..."]:not([id="copytext"])').focus();
    }
    // console.log(event.key);
});

// Проверка существования кнопки открытия bash для терминала и логов
function checkToolbar() {
    if (window.location.pathname.indexOf('/logs') > 0) {
        if (document.querySelectorAll('div[class="co-toolbar__item"]').length == 2
            && document.getElementById('logs') == null) {
            let image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAABmJLR0QA/wD/AP+gvaeTAAADjUlEQVR4nO3cXUhTcRzG8efM+bJk2osz0y1tEIhvSFhSEBWiXeaNFxJERRe9QhBRFHQRFNFVRGQ3UdGLRFfeRQR5ZVEYkTYqYYk6MstQl29zntNFL9iWp6j9z2/zPJ87zxk7f/bFH+eFDSAiIiIispwWu6HhbEep5tBuSyxmoTN0Y/uDExtez93mjHuV5sgGjDWWrcpONEd27Kb4AHNsqfYhOytD3YJsYHwqgkcv+ufdbxrAt2I5wjOOhC/KTnxLdMAkAD9dYQwgjAGEMYAwBhDGAMIYQBgDCGMAYQwgzPRWhMc1C29umlVrWZCmI7Om+00DlLijWF2QmdAF2U3PYNR0P0eQMAYQxgDCGEAYAwhjAGEMIIwBhDGAMAYQxgDCGEAYAwhjAGEMIIwBhDGAMOUBpmZ0DI1Nqz5MyjJ9JJkIh292o+/TJJpqC7Fjoxdpjrgv5diaJSNINwzcfRLCsdYAhsMRKw6ZMpQHON9chrX+xQCA7oEw9l17iWfBEdWHTRnKA+S4nDjdVIq9dSVwOjSMTUZx6t5rtDzsRVQ3VB8+6VkygjQAjTUFONdchmXuDBgA2joHcZwjydrT0AqvGy27qjiS5rD8OoAj6VciF2LzjaQjt17hw6i9rhlEr4RjR9Kb919w6EaXrUaS+K0Iu48k8QCAvc+SkiLADxVeNy7vrERZkRvAt7Ok/de7EAiFhVemTlIFAICnwREEh8Z//r3Ovxj+/LjfuFgwlN+M+1uRqI6r7X1o6xwEAGQ4Hdi9aSUaawqEV6ZWUgToH57EmbYe9H6cAAD4lrlwcttqlHgWCa9MPfEAD7s/4tKDd5ia0QEAdeV5OLTVj6z0pJuOSogFsOvIiSUSwM4jJ5blAew+cmJZFoAj5/csCcCRMz/lAdoDn3DhfvDnyKmv8OBAwyrbjpxYygNc/D7vM9MdOFi/CvWVHtWHTCnKAzTVFiIQCmPP5mIU57kS9r5DY9MYnTD/Fvr/0DTAu9Sl/D9VeYDm9UUJf89XA2EcvROAbqi9XV3iWYQru6uUHoODWJj4rYh/Ue514/reaktGkGopGQAA8nMykZ+T+r/kwhEkjAGEMYAwBhDGAMIYQBgDCGMAYQwgjAGEMYAwBhDGAMIYQBgDCGMAYQwgzPSJWOvjEHJdKfvQLCmMTpo/NjX9dDvefk7oYihefABDH4emPRdYy8Jn6ON/fhERERERkXJfAVRiHkwPywY1AAAAAElFTkSuQmCC'
            document.querySelectorAll('div[class="co-toolbar__item"]')[1].parentNode.appendChild(createToolbarItem('logs', image));
        }
    } else if (window.location.pathname.indexOf('/terminal') > 0) {
        if (document.querySelectorAll('div[class="co-toolbar__item"]').length == 3
            && document.getElementById('terminal') == null) {
            let image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAABmJLR0QA/wD/AP+gvaeTAAACnUlEQVR4nO2bS4sTQRRGTyfxEVFnxBnBBwMqggtx6V4QwR+gP2BgwJ0LX2u3sxLEpeBSBRERBUEERRBREUHEhTAPFAQRd64y0y4qgU4pmuR2parId+ASQtJd957uJN2VWyCEEJNL4T3fAcwBrQi55EAHWAV++i/sA+5331Aq/hkd4B6wtydvF7CSQGK5xTIw2wQWgROIYZkG2gXwFdgTOZlc+VIAa0AjdiaZsl7gPs9iRHTmGZFAIxJoRAKNSKAQYpIpgDexk8gZ3YkY0a+wEQk0IoFGJNCIBBqRQCMSaEQCjUigEQk0Mg6Ba2MYIxohBa4AB4Ap4FbAcaITqvXhWmWMJnAn4FgxI9iOP+POvh4bcE05sQvORmAJvAS2VSRuBB4kUHQ2AkvgBbDVk/gwgcKzEVgCT4B2RWIbeJpA8dkILIHHwOaKxC3AswQEZCOwBB4BmyoStwOvEpCQjcASuEt/D/YU8DoBEdkILHHXhM2KxGngbQIyshFYAjfpvxOaBT4kIGSoiDmZcAq3OqDHd+BGpFxMxDhy34AjXh7zuImH6GfVkDH2AVeBQ568hUzljV3gMnDQk3cWWE9ARPICl4D9nrzzCQjIQuAnKkujulxKoPgsBH4EdnvyLidQeBYC3wEznrwrCRRdW4Rsb3sPHKd/aegicPE/21zgL8tJjbSA07jv3NoJdXTOVMYogKsDbHMyRIEVlow1/REh70SOdR8bwHXg3ADb+NeHdTID7Kx7p6E7VJ/jJgqODvj+Dm7h94+a82jhlvTO1bxftfhaUWeCEQk0IoFGJNCIBBqRQCMSaEQCjUigEQk0IoFGJNCIBBqRQCMSaEQCjUigkQZuGl2MRqeBa3YUo3G7wP0vchjX9C0G5xeuZUUIISaW31GM77KDnP7QAAAAAElFTkSuQmCC'
            document.querySelectorAll('div[class="co-toolbar__item"]')[1].parentNode.appendChild(createToolbarItem('terminal', image));
        }
    }
}

// Создание кнопки запуска bash для терминала и логов
function createToolbarItem(id, image) {
    let img = document.createElement('img');
    img.src = image;
    img.width = 30;
    img.height = 30;
    let div = createElement('div', 'co-toolbar__item', id);
    div.setAttribute('style', 'cursor: pointer');
    div.appendChild(img);
    div.addEventListener('click', (event) => {
        let title_span = document.querySelector('span[data-test-id="resource-title"]');
        if (title_span == null) {
            return;
        }
        let pod = title_span.textContent;
        let button = document.querySelector('button[data-test-id="dropdown-button"]');
        if (button == null) {
            return;
        }
        let span = button.querySelector('span[class="pf-c-dropdown__toggle-text"]');
        if (span == null) {
            return;
        }
        container = span.textContent;
        container = container.replace('\n', '');
        container = container.replace('ContainerC', '');
        let command = '';
        if (project != null) {
            command += 'oc project ' + project + ' && ';
        }
        switch (id) {
            case 'logs':
                command += "oc logs --tail 100 -f " + pod + " -c " + container;
                break;
            case 'terminal':
                command += "oc rsh -c " + container + " " + pod;
                break;
        }
        copyToClipboard(command);
    });
    return div;
}

// Изменить отключённую кнопку у Pod (Terminated) на копирование в буфер обмена команды на удаление
function changedDisabledButtonPod() {
    if (project == null
        || document.querySelector('span[data-test-id="resource-title"]') == null
        || document.querySelector('span[data-test-id="resource-title"]').textContent != 'Pods') {
        return;
    }
    if (document.getElementById('copytext') == null && document.getElementById('content-scrollable') != null) {
        createCopyTextElement();
    }
    let buttons = document.querySelectorAll('button[class*="pf-c-dropdown__toggle pf-m-plain"][disabled]');
    for (let i = 0; i < buttons.length; i++) {
        let a = buttons[i].parentNode.parentNode.parentNode.querySelector('a');
        if (a == null) {
            continue;
        }
        let command = 'oc delete pod ' + a.text + ' -n ' + project + ' --grace-period=0 --force';
        buttons[i].textContent = '✂';
        buttons[i].addEventListener('click', (event) => {
            if (project != null) {
                command = 'oc project ' + project + ' && ' + command;
            }
            copyToClipboard(command, 'для удаления Pod');
        });
        buttons[i].disabled = false;
    }
}

// Получение атрибутов для копирования в буфер обмена
function copyToClipboard(command, description) {
    document.getElementById("copytext").value = command;
    document.getElementById("copytext").select();
    document.execCommand("copy");
    alert('Команда ' + (description ? description + ' ' : '') + 'скопирована в буфер обмена. Выполните её через терминал.');
}

// Добавление элемента для возможности копирования текста
function createCopyTextElement() {
    if (document.getElementById('copytext') == null) {
        let copytext = document.createElement('input');
        copytext.setAttribute('id', 'copytext');
        copytext.setAttribute('style', 'opacity: 0');
        document.getElementById('content-scrollable').appendChild(copytext);
    }
}

// Добавление ресурсов и переименование
function addedKinds() {
    let buttons = document.querySelectorAll('button[class="pf-c-nav__link"]');
    if (buttons.length > 1 && buttons[1].textContent == "Operators" && project != null) {
        let button = buttons[1];
        button.replaceChild(document.createTextNode('Resources'), button.firstChild);
        let li = button.parentNode;
        let ul = li.querySelector('ul');
        if (ul != null) {
            for (let i = 0; i < kinds.length; i++) {
                if (kinds[i] == null) {
                    // Добавление разделителя
                    let liSeparator = document.createElement('li');
                    liSeparator.id = 'ResourcesSeparator' + i;
                    liSeparator.name = 'ResourcesSeparator' + i;
                    liSeparator.setAttribute('role', 'separator');
                    liSeparator.className = 'pf-c-divider';
                    ul.appendChild(liSeparator);
                    continue;
                }
                let name = generateResourceName(kinds[i].split('~')[2]);
                let child = ul.appendChild(createElementLi(name, '/k8s/ns/' + project + '/' + kinds[i]));
                if (window.location.pathname.indexOf(kinds[i]) > 0) {
                    li.querySelector('button').click();
                    child.classList.add('pf-m-current');
                }
            }
        }
    }
    // Развернуть пункты меню Resources - 1, Workloads - 2, Networking - 3
    for (let i = 1; i <= 3; i++) {
        if (buttons[i].nextElementSibling.hidden) {
            buttons[i].click()
        }
    }
}

// Изменение ссылок при смене проекта
function changeHrefKinds() {
    let aides = document.querySelectorAll('li[class*="aide"]');
    for (let i = 0; i < aides.length; i++) {
        let href = document.querySelectorAll('li[class*="aide"]')[i].childNodes[0].href;
        if (href.split('/').length > 6) {
            document.querySelectorAll('li[class*="aide"]')[i].childNodes[0].href = '/k8s/ns/' + project + '/' + href.split('/')[6];
        }
    }
}

// Удаление фокуса с кастомного элемента
function removeFocus() {
    if (document.querySelectorAll('li[class*="pf-m-current"]').length > 2) {
        let li = document.querySelector('li[class*="pf-m-current"][class*="aide"]');
        if (li != null) {
            li.classList.remove('pf-m-current');
        }
    }
}

// Определение названия пространства
function getProjectName() {
    let a = document.querySelector('a[aria-label="Import YAML"]');
    let project = null;
    if (a != null && a.href.split('/').length > 3) {
        project = a.href.split('/')[5];
    }
    return project;
}

// Генерация названия ресурса по названию kind
function generateResourceName(kindName) {
    if (kindName.length == 0) {
        return '';
    }
    let name = kindName.slice(0, 1);
    for (let char of kindName.slice(1)) {
        if (char == char.toUpperCase()) {
            name += ' ';
        }
        name += char;
    }
    if (name.slice(-1) == 'y' && name.slice(-2) != 'ay') {
        name = name.slice(0, -1) + 'ies';
    } else if (name.slice(-1) == 'e' || name.slice(-1) == 'r' || name.slice(-1) == 'n' || name.slice(-2) == 'ay') {
        name += 's';
    }
    return name;
}

// Создание универсального элемента
function createElement(tagName, className = null, id = null) {
    let element = document.createElement(tagName);
    if (className != null) {
        element.className = className;
    }
    if (id != null) {
        element.id = id;
    }
    return element;
}

function createElementLi(name, href) {
    let li = document.createElement('li');
    li.className = 'pf-c-nav__item aide';
    li.appendChild(createElementA(name, href));
    return li;
}

function createElementA(text, href) {
    let a = document.createElement('a');
    a.className = 'pf-c-nav__link pf-c-nav__link';
    a.href = href;
    a.innerText = text;
    return a;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
