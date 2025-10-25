class EmployeeEditor {
    constructor() {
        this.employeeData = null;
        this.isEditing = false;
        this.init();
    }

    init() {
        this.loadData();
        this.createEditorUI();
        this.setupEventListeners();
    }

    loadData() {
        // Загружаем данные из employee-data.js или из localStorage
        if (typeof employeeData !== 'undefined') {
            this.employeeData = JSON.parse(JSON.stringify(employeeData.employee));
        } else {
            // Данные по умолчанию
            this.employeeData = {
                "full_name": "Иванов Сергей Петрович",
                "position": "Ведущий инженер по компьютерному зрению",
                "company": "ООО «Рога и Копыта»",
                "department": "Департамент компьютерного зрения",
                "office_location": "Новосибирск, техноларк «Идея»",
                "contact": {
                    "email": "sergey.ivanov@tldp.ru",
                    "telegram": "@sergey_vision"
                },
                "branding": {
                    "logo_url": "",
                    "corporate_colors": {
                        "primary": "#0052CC",
                        "secondary": "#0088D9"
                    },
                    "slogan": "Инновации в каждый кадр"
                },
                "privacy_level": "low"
            };
        }

        // Пытаемся загрузить из localStorage
        const savedData = localStorage.getItem('employeeCustomData');
        if (savedData) {
            try {
                this.employeeData = JSON.parse(savedData);
                console.log('✅ Данные загружены из localStorage');
            } catch (e) {
                console.error('❌ Ошибка загрузки из localStorage:', e);
            }
        }
    }

    createEditorUI() {
        const controlsPanel = document.querySelector('.controls-panel');
        if (!controlsPanel) return;

        const editorHTML = `
            <div class="employee-editor">
                <h3>✏️ Редактор данных сотрудника</h3>
                
                <div class="form-group">
                    <label for="editFullName">ФИО:</label>
                    <input type="text" id="editFullName" value="${this.escapeHtml(this.employeeData.full_name)}">
                </div>

                <div class="form-group">
                    <label for="editPosition">Должность:</label>
                    <input type="text" id="editPosition" value="${this.escapeHtml(this.employeeData.position)}">
                </div>

                <div class="form-group">
                    <label for="editCompany">Компания:</label>
                    <input type="text" id="editCompany" value="${this.escapeHtml(this.employeeData.company)}">
                </div>

                <div class="form-group">
                    <label for="editDepartment">Отдел:</label>
                    <input type="text" id="editDepartment" value="${this.escapeHtml(this.employeeData.department)}">
                </div>

                <div class="form-group">
                    <label for="editLocation">Местоположение:</label>
                    <input type="text" id="editLocation" value="${this.escapeHtml(this.employeeData.office_location)}">
                </div>

                <div class="form-section">
                    <h4>Контакты</h4>
                    <div class="form-group">
                        <label for="editEmail">Email:</label>
                        <input type="email" id="editEmail" value="${this.escapeHtml(this.employeeData.contact.email)}">
                    </div>
                    <div class="form-group">
                        <label for="editTelegram">Telegram:</label>
                        <input type="text" id="editTelegram" value="${this.escapeHtml(this.employeeData.contact.telegram)}">
                    </div>
                </div>

                <div class="form-section">
                    <h4>Брендинг</h4>
                    <div class="form-group">
                        <label for="editSlogan">Слоган:</label>
                        <input type="text" id="editSlogan" value="${this.escapeHtml(this.employeeData.branding.slogan)}">
                    </div>
                </div>

                <div class="form-actions">
                    <button id="saveData">💾 Сохранить</button>
                    <button id="resetData">🔄 Сбросить</button>
                </div>

                <div id="editorMessage" class="message" style="display: none;"></div>
            </div>
        `;

        // Вставляем редактор после блока управления цветом текста
        const textColorControls = document.querySelector('.text-color-controls');
        if (textColorControls) {
            textColorControls.insertAdjacentHTML('afterend', editorHTML);
        } else {
            controlsPanel.insertAdjacentHTML('afterbegin', editorHTML);
        }
    }

    setupEventListeners() {
        document.getElementById('saveData')?.addEventListener('click', () => this.saveData());
        document.getElementById('resetData')?.addEventListener('click', () => this.resetData());

        // Автосохранение при изменении полей
        const inputs = document.querySelectorAll('.employee-editor input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateDataFromForm();
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateDataFromForm() {
        this.employeeData = {
            full_name: document.getElementById('editFullName').value,
            position: document.getElementById('editPosition').value,
            company: document.getElementById('editCompany').value,
            department: document.getElementById('editDepartment').value,
            office_location: document.getElementById('editLocation').value,
            contact: {
                email: document.getElementById('editEmail').value,
                telegram: document.getElementById('editTelegram').value
            },
            branding: {
                logo_url: this.employeeData.branding.logo_url,
                corporate_colors: this.employeeData.branding.corporate_colors, // Сохраняем старые цвета
                slogan: document.getElementById('editSlogan').value
            },
            privacy_level: this.employeeData.privacy_level
        };
    }

    saveData() {
        this.updateDataFromForm();
        
        try {
            localStorage.setItem('employeeCustomData', JSON.stringify(this.employeeData));
            this.showMessage('✅ Данные успешно сохранены!', 'success');
            
            // Обновляем отображение
            if (window.employeeDisplay) {
                window.employeeDisplay.employeeData = this.employeeData;
                window.employeeDisplay.updateDisplay();
            }
            
            console.log('💾 Данные сохранены:', this.employeeData);
        } catch (e) {
            this.showMessage('❌ Ошибка сохранения данных', 'error');
            console.error('Ошибка сохранения:', e);
        }
    }

    resetData() {
        if (confirm('Вы уверены, что хотите сбросить все данные к исходным?')) {
            localStorage.removeItem('employeeCustomData');
            this.loadData();
            this.populateForm();
            this.showMessage('🔄 Данные сброшены к исходным', 'success');
            
            if (window.employeeDisplay) {
                window.employeeDisplay.employeeData = this.employeeData;
                window.employeeDisplay.updateDisplay();
            }
        }
    }

    populateForm() {
        document.getElementById('editFullName').value = this.employeeData.full_name;
        document.getElementById('editPosition').value = this.employeeData.position;
        document.getElementById('editCompany').value = this.employeeData.company;
        document.getElementById('editDepartment').value = this.employeeData.department;
        document.getElementById('editLocation').value = this.employeeData.office_location;
        document.getElementById('editEmail').value = this.employeeData.contact.email;
        document.getElementById('editTelegram').value = this.employeeData.contact.telegram;
        document.getElementById('editSlogan').value = this.employeeData.branding.slogan;
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('editorMessage');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = `message ${type}`;
            messageEl.style.display = 'block';
            
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }
    }

    getEmployeeData() {
        return this.employeeData;
    }
}