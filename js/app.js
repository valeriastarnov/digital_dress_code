class DigitalDressCodeApp {
    constructor() {
        this.segmentator = new Segmentator();
        this.videoProcessor = new VideoProcessor();
        this.employeeDisplay = null;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация Digital Dress Code...');
        
        try {
            if (document.readyState === 'loading') {
                await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
            }
            
            this.employeeDisplay = new EmployeeDisplay();
            this.videoProcessor.setSegmentator(this.segmentator);
            this.videoProcessor.setEmployeeDisplay(this.employeeDisplay);
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ Приложение инициализировано');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('startCamera').addEventListener('click', () => {
            this.startCamera();
        });

        document.getElementById('stopCamera').addEventListener('click', () => {
            this.stopCamera();
        });

        document.getElementById('backgroundSelect').addEventListener('change', (e) => {
            this.videoProcessor.setBackground(e.target.value);
        });

        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    async startCamera() {
        console.log('📹 Запускаем камеру...');
        
        this.updateStatus('Запуск камеры...');
        this.toggleCameraButtons(true);
        
        try {
            const cameraStarted = await this.videoProcessor.startCamera();
            
            if (cameraStarted) {
                this.updateStatus('Загрузка модели...');
                
                setTimeout(() => {
                    this.videoProcessor.backgroundManager.preloadVideo().then(success => {
                        if (success) {
                            console.log('✅ Видео фон загружен');
                        } else {
                            console.log('⚠️ Видео фон не загружен, но продолжаем работу');
                        }
                    });
                }, 1000);
                
                await this.segmentator.loadModel();
                this.updateStatus('Камера запущена');
                this.videoProcessor.startProcessing();
            } else {
                this.updateStatus('Ошибка камеры');
                this.toggleCameraButtons(false);
            }
            
        } catch (error) {
            console.error('❌ Ошибка запуска:', error);
            this.updateStatus('Ошибка запуска');
            this.toggleCameraButtons(false);
        }
    }

    stopCamera() {
        console.log('🛑 Останавливаем камеру...');
        
        this.videoProcessor.stopProcessing();
        this.videoProcessor.stopCamera();
        this.updateStatus('Камера выключена');
        this.toggleCameraButtons(false);
    }

    toggleCameraButtons(cameraRunning) {
        const startBtn = document.getElementById('startCamera');
        const stopBtn = document.getElementById('stopCamera');
        
        if (startBtn && stopBtn) {
            startBtn.disabled = cameraRunning;
            stopBtn.disabled = !cameraRunning;
        }
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    cleanup() {
        this.videoProcessor.stopCamera();
        console.log('🧹 Очистка ресурсов...');
    }
}

// Запускаем приложение после загрузки DOM
window.addEventListener('DOMContentLoaded', () => {
    new DigitalDressCodeApp();
});