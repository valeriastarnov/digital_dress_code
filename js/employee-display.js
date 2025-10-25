class EmployeeDisplay {
    constructor() {
        this.currentPrivacyLevel = 'low';
        this.currentTextColor = 'dark';
        this.employeeData = this.loadEmployeeData();
        this.init();
    }

    loadEmployeeData() {
        // Сначала пытаемся загрузить из редактора
        if (window.employeeEditor) {
            return window.employeeEditor.getEmployeeData();
        }
        
        // Затем из localStorage
        const savedData = localStorage.getItem('employeeCustomData');
        if (savedData) {
            try {
                return JSON.parse(savedData);
            } catch (e) {
                console.error('Ошибка загрузки данных:', e);
            }
        }
        
        // Иначе используем стандартные данные
        return employeeData.employee;
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.updateDisplay();
            });
        } else {
            this.setupEventListeners();
            this.updateDisplay();
        }
    }

    setupEventListeners() {
        // Кнопки приватности
        const privacyButtons = document.querySelectorAll('.privacy-btn');
        if (privacyButtons.length > 0) {
            privacyButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-level') === 'low') {
                    btn.classList.add('active');
                }
                
                btn.addEventListener('click', (e) => {
                    const level = e.target.getAttribute('data-level');
                    this.setPrivacyLevel(level);
                });
            });
        }

        // Кнопки цвета текста
        const colorButtons = document.querySelectorAll('.color-btn');
        if (colorButtons.length > 0) {
            colorButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-color') === 'dark') {
                    btn.classList.add('active');
                }
                
                btn.addEventListener('click', (e) => {
                    const color = e.target.getAttribute('data-color');
                    this.setTextColor(color);
                });
            });
        }
    }

    setPrivacyLevel(level) {
        this.currentPrivacyLevel = level;
        
        const privacyButtons = document.querySelectorAll('.privacy-btn');
        privacyButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-level') === level) {
                btn.classList.add('active');
            }
        });

        this.updateDisplay();
        console.log(`🔒 Уровень приватности изменен на: ${level}`);
    }

    setTextColor(color) {
        this.currentTextColor = color;
        
        const colorButtons = document.querySelectorAll('.color-btn');
        colorButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-color') === color) {
                btn.classList.add('active');
            }
        });

        console.log(`🎨 Цвет текста изменен на: ${color === 'dark' ? 'Темный' : 'Светлый'}`);
    }

    updateDisplay() {
        const previewElement = document.getElementById('employeePreview');
        if (!previewElement) return;

        const data = this.getDisplayData();
        
        let html = `
            <div class="employee-preview-card">
                <div class="employee-name">${data.full_name}</div>
                <div class="employee-position">${data.position}</div>
        `;

        if (data.company) {
            html += `<div class="employee-company">${data.company}</div>`;
        }

        if (data.department) {
            html += `<div class="employee-department">${data.department}</div>`;
        }

        if (data.office_location) {
            html += `<div class="employee-location">${data.office_location}</div>`;
        }

        if (data.contact && this.currentPrivacyLevel === 'high') {
            html += `
                <div class="employee-contacts">
                    <div class="contact-email">📧 ${data.contact.email}</div>
                    <div class="contact-telegram">✈️ ${data.contact.telegram}</div>
                </div>
            `;
        }

        if (data.branding && this.currentPrivacyLevel === 'high') {
            html += `
                <div class="employee-branding">
                    <div class="slogan">"${data.branding.slogan}"</div>
                </div>
            `;
        }

        html += `</div>`;
        previewElement.innerHTML = html;
    }

    getDisplayData() {
        // Всегда загружаем свежие данные
        this.employeeData = this.loadEmployeeData();
        const data = { ...this.employeeData };
        
        switch (this.currentPrivacyLevel) {
            case 'low':
                return {
                    full_name: data.full_name,
                    position: data.position
                };

            case 'medium':
                return {
                    full_name: data.full_name,
                    position: data.position,
                    company: data.company,
                    department: data.department,
                    office_location: data.office_location
                };

            case 'high':
                return data;

            default:
                return data;
        }
    }

    drawOnCanvas(ctx, x, y, width, height) {
        if (!ctx) return;
        
        const data = this.getDisplayData();
        
        ctx.save();
        ctx.scale(-1, 1);
        
        // Позиция в левом верхнем углу (зеркально)
        const textX = -ctx.canvas.width + 20; // Отступ 20px от левого края
        const textY = 20; // Отступ 20px от верхнего края
        
        const colors = this.getTextColors();
        
        // УБИРАЕМ полупрозрачный фон - закомментировали эту строку
        // ctx.fillStyle = colors.background;
        // ctx.fillRect(textX, textY, width, this.calculateHeight(data));
        
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        let currentY = textY;
        
        ctx.font = 'bold 16px Arial';
        ctx.fillText(data.full_name, textX, currentY);
        currentY += 25;
        
        ctx.font = '14px Arial';
        ctx.fillText(data.position, textX, currentY);
        currentY += 20;
        
        if (data.company) {
            ctx.fillText(data.company, textX, currentY);
            currentY += 20;
        }
        
        if (data.department) {
            ctx.fillText(data.department, textX, currentY);
            currentY += 20;
        }
        
        if (data.office_location) {
            ctx.fillText(data.office_location, textX, currentY);
            currentY += 20;
        }
        
        if (this.currentPrivacyLevel === 'high' && data.contact) {
            ctx.fillText(`Email: ${data.contact.email}`, textX, currentY);
            currentY += 20;
            ctx.fillText(`Telegram: ${data.contact.telegram}`, textX, currentY);
            currentY += 20;
            
            if (data.branding && data.branding.slogan) {
                ctx.font = 'italic 12px Arial';
                ctx.fillText(`"${data.branding.slogan}"`, textX, currentY);
            }
        }
        
        ctx.restore();
    }

    getTextColors() {
        if (this.currentTextColor === 'light') {
            return {
                background: 'rgba(0, 0, 0, 0.7)',
                text: '#ffffff'
            };
        } else {
            return {
                background: 'rgba(255, 255, 255, 0.8)',
                text: '#000000'
            };
        }
    }

    calculateHeight(data) {
        let lines = 2;
        
        if (data.company) lines++;
        if (data.department) lines++;
        if (data.office_location) lines++;
        
        if (this.currentPrivacyLevel === 'high') {
            lines += 2;
            if (data.branding && data.branding.slogan) lines++;
        }
        
        return lines * 20 + 20;
    }

    getCurrentPrivacyLevel() {
        return this.currentPrivacyLevel;
    }

    getCurrentTextColor() {
        return this.currentTextColor;
    }
}