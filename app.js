// Puppeteer 사용을 위해 require 추가
const puppeteer = require('puppeteer');

// SSL 인증서 문제 우회를 위한 설정 (개발/테스트 용도)
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'; 

var express = require('express');
var fs      = require('fs');
// var request = require('request'); // Puppeteer로 대체
// var cheerio = require('cheerio'); // Puppeteer의 evaluate/DOM API로 대체
var cors    = require('cors'); 
var app     = express();

// CORS 허용 (모든 오리진 허용)
app.use(cors()); 

// IMDb 기본 URL (링크 생성을 위해 전역 변수나 상수로 설정)
const IMDB_BASE_URL = 'https://www.imdb.com';

/**
 * Puppeteer를 사용하여 IMDb Top 250 데이터를 스크래핑합니다.
 * Puppeteer는 브라우저를 실행하여 지연 로딩되는 250개 항목을 모두 가져옵니다.
 * @param {string} url - 스크래핑할 URL
 * @param {function(Error|null, Object|null): void} callback - 결과를 처리할 콜백 함수
 */
async function scrapeImdb(url, callback) {
    let browser;
    
    // ⭐️ 로컬 환경에서 Puppeteer의 내장 Chromium 대신 시스템 Chrome/Edge 사용을 위한 경로 설정
    // ⚠️ 사용자님께서는 이 경로를 본인의 Chrome/Edge 실행 파일 경로로 꼭 바꿔주셔야 합니다.
    const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    try {
        console.log("🚀 Puppeteer 브라우저 실행 시도 (환경 우회 및 경로 명시 재시도)...");
        
        // 1. Puppeteer 브라우저 실행 (경로 명시 + 안정적인 구버전 headless)
        browser = await puppeteer.launch({ 
            // ⭐️ 환경 충돌 가능성을 줄이기 위해 안정적인 구버전 headless 모드 사용
            headless: true, 
            executablePath: CHROME_PATH, // ⭐️ 실행 파일 경로를 다시 명시적으로 지정
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', 
                '--no-zygote',
                '--single-process', 
                '--disable-accelerated-2d-canvas', 
                '--no-first-run',
                '--no-default-browser-check'
            ]
        });
        const page = await browser.newPage();
        
        // ⭐️ 봇 탐지 회피 1: User-Agent 설정
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // ⭐️ 봇 탐지 회피 2: Viewport 설정 (일반적인 데스크톱 크기)
        await page.setViewport({ width: 1366, height: 768 });

        // 2. IMDb 페이지 접속
        console.log(`페이지 접속: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); 

        // ⭐️ 추가: 페이지가 로드되었는지 확인하고 HTML의 일부분을 출력
        const pageTitle = await page.title();
        console.log(`✅ 페이지 제목 확인: ${pageTitle}`);

        // 본문(body)의 첫 500자리를 가져와서 Cloudflare 같은 보호 장벽에 막혔는지 확인
        const pageContentSample = await page.evaluate(() => {
            return document.body.innerText.substring(0, 500);
        });
        console.log("--- 페이지 내용 샘플 (첫 500자) ---");
        console.log(pageContentSample.substring(0, 200) + '...'); // 너무 길면 잘라서 출력
        console.log("----------------------------------");
        
        // 3. 지연 로딩 대기: 모든 250개 항목이 로드될 때까지 스크롤 다운을 반복합니다.
        let lastMovieCount = 0;
        let stabilityCounter = 0; // 로드된 영화 개수로 안정성 체크
        const maxStabilityChecks = 10;
        
        while (stabilityCounter < maxStabilityChecks) {
            // 페이지 끝으로 스크롤
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기

            // 현재 로드된 영화 아이템 개수 확인
            const currentMovieCount = await page.evaluate(() => {
                // ⭐️ 셀렉터 유효성 검증을 위해 콘솔 로그 추가
                const count = document.querySelectorAll('.ipc-metadata-list--base > li').length;
                console.log(`[Browser Console] 현재 아이템 수: ${count}`); 
                return count;
            });
            
            console.log(`[Node Console] 현재 로드된 영화 개수: ${currentMovieCount}`);

            if (currentMovieCount > lastMovieCount) {
                // 새로운 영화가 로드됨: 카운터 리셋
                lastMovieCount = currentMovieCount;
                stabilityCounter = 0;
            } else {
                // 영화 개수에 변화가 없음: 카운터 증가
                stabilityCounter++;
            }
            
            // 250개에 도달했거나 최대 안정화 체크 횟수에 도달하면 종료
            if (lastMovieCount >= 250 || stabilityCounter >= maxStabilityChecks) {
                if (lastMovieCount < 250) {
                    console.warn(`스크롤 종료. ${lastMovieCount}개에서 멈춤 (안정성 체크 ${stabilityCounter}회).`);
                } else {
                    console.log(`🎉 250개 영화 로드 완료.`);
                }
                break;
            }
        }
        
        // 4. Puppeteer의 evaluate를 사용하여 브라우저 환경에서 직접 DOM 파싱 및 데이터 추출
        const top250 = await page.evaluate((IMDB_BASE_URL) => {
            const list = [];
            // JQuery/Cheerio의 셀렉터와 유사한 document.querySelectorAll 사용
            const movieItems = document.querySelectorAll('.ipc-metadata-list--base > li'); 
            
            console.log(`[Browser Console] 최종 파싱 시도 아이템 수: ${movieItems.length}`);
            
            movieItems.forEach((self, i) => {
                const index = i + 1;
                
                try {
                    // 데이터 파싱: Puppeteer 내부에서는 DOM API를 사용합니다.
                    const nameElement = self.querySelector('.ipc-title-link-wrapper > h3');
                    const _name = nameElement ? nameElement.textContent.replace(/^\d+\.\s*/, '').trim() : ''; 
                    
                    const yearElement = self.querySelector('.cli-title-metadata > span');
                    const _year = yearElement ? yearElement.textContent.trim() : '';
                    
                    const ratingElement = self.querySelector('.ipc-rating-star > span');
                    const _rating = ratingElement ? ratingElement.textContent.split('(')[0].trim() : '';
                    
                    const posterElement = self.querySelector('.ipc-image');
                    const _poster = posterElement ? posterElement.getAttribute('src') : 'N/A';
                    
                    const linkElement = self.querySelector('.ipc-title-link-wrapper');
                    const relativeLink = linkElement ? linkElement.getAttribute('href') : null;
                    
                    let _link = 'N/A';
                    if (relativeLink) {
                        const cleanLink = relativeLink.split('?')[0]; 
                        _link = `${IMDB_BASE_URL}${cleanLink}`; 
                    }

                    if (_name && _year && _rating && _link !== 'N/A') {
                        list.push({
                            index  : index,
                            name   : _name,
                            year   : _year,
                            rating : _rating,
                            poster : _poster,
                            link   : _link 
                        });
                    }
                } catch (e) {
                    // console.error(`Error parsing movie item ${index}:`, e); // evaluate 내부 에러는 밖으로 전달하기 어려워 주석 처리
                }
            });

            return list;
        }, IMDB_BASE_URL); // IMDB_BASE_URL을 evaluate 함수 내부로 전달

        // 5. 파싱 성공 검증
        if (top250.length < 250) {
            console.warn(`주의: 예상보다 적은 수(${top250.length}개)의 영화가 로드되었습니다.`);
        }
        
        callback(null, top250); // 성공
            
    } catch (e) {
        console.error('🛑 스크래핑 중 치명적인 예외 발생 (브라우저 실행 또는 접속 실패):', e);
        // 오류를 명확하게 전달
        callback(new Error(`Puppeteer 실행 실패: ${e.message}. 환경 설정을 확인하거나, Chrome/Chromium 설치가 제대로 되었는지 확인하세요.`), []);
    } finally {
        // 6. 브라우저 닫기 (필수)
        if (browser) {
            console.log("브라우저 닫기.");
            await browser.close();
        }
    }
}


/**
 * 1. 일반 JSON 데이터 제공 엔드포인트
 */
app.get('/', function(req, res){
    var url = 'https://www.imdb.com/chart/top/';
    
    scrapeImdb(url, function(err, top250){
        if (err) {
            // 에러 발생 시 500 응답
            var detail = err.detail ? err.detail.message : err.message;
            return res.status(500).json({ error: 'Scraping failed', detail: detail });
        }
        
        console.log(`✅ 파싱 성공! ${top250.length}개의 영화 데이터를 가져왔습니다.`);
        res.json(top250);
    });
});


/**
 * 2. JSON 파일을 다운로드하도록 강제하는 엔드포인트
 */
app.get('/download', function(req, res){
    var url = 'https://www.imdb.com/chart/top/';
    
    scrapeImdb(url, function(err, top250){
        if (err) {
            var detail = err.detail ? err.detail.message : err.message;
            return res.status(500).json({ error: 'Scraping failed', detail: detail });
        }
        
        console.log(`⬇️ 파일 다운로드 요청: ${top250.length}개 데이터`);
        
        // ⭐️ 핵심: 파일 다운로드를 강제하는 HTTP 헤더 설정
        res.setHeader('Content-Disposition', 'attachment; filename="imdb-top250.json"');
        res.setHeader('Content-Type', 'application/json');

        // JSON 파일로 로컬 디스크에 저장 (원래 기능 유지)
        fs.writeFile('imdb-top250.json', JSON.stringify(top250, null, 4), function(fileErr){
            if (fileErr) console.error('File write error:', fileErr);
            else console.log('imdb-top250.json 파일 생성 완료.');
        });
        
        // 클라이언트에게 JSON 데이터 응답 (이것이 파일 다운로드로 이어짐)
        res.json(top250);
    });
});


var port = 81;
app.listen(port, function(){
    console.log(`IMDb Scraper Server running on port ${port}.`);
    console.log(`일반 JSON API: http://localhost:${port}/`);
    console.log(`파일 다운로드 API: http://localhost:${port}/download`);
});
exports = module.exports = app;