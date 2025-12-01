# IMDB-top250-node

IMDB's top 250 list scraper for nodejs
inspired by [https://github.com/ahmetozantekin/imdb-top250-node/tree/master](https://github.com/ahmetozantekin/imdb-top250-node/tree/master)

⭐️ 로컬 환경에서 Puppeteer의 내장 Chromium 대신 시스템 Chrome/Edge 사용을 위한 경로 설정  
⚠️ 사용자님께서는 이 경로를 본인의 Chrome/Edge 실행 파일 경로로 꼭 바꿔주셔야 합니다.
```
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
```

```sh
$ git clone
$ npm install
$ node app
```

localhost:81
localhost:81/download

### Output

```sh
[
  {
    "index": 1,
    "name": "쇼생크 탈출",
    "year": "1994",
    "rating": "9.3",
    "poster": "https://m.media-amazon.com/images/M/MV5BNjFjMGZiOTgtNWNmMi00MzMyLTgzMjQtMGJiZTI4NDc1MjU1XkEyXkFqcGc@._V1_QL75_UY133_CR6,0,90,133_.jpg",
    "link": "https://www.imdb.com/title/tt0111161/"
  },
  {
    "index": 2,
    "name": "Daeboo",
    "year": "1972",
    "rating": "9.2",
    "poster": "https://m.media-amazon.com/images/M/MV5BNDI0M2M2N2ItNmEyMy00NDQ1LWI0MzEtY2ZmMWM0ODQzMTUyXkEyXkFqcGc@._V1_QL75_UY133_CR2,0,90,133_.jpg",
    "link": "https://www.imdb.com/title/tt0068646/"
  },
  {
    "index": 3,
    "name": "다크 나이트",
    "year": "2008",
    "rating": "9.1",
    "poster": "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_QL75_UX90_CR0,0,90,133_.jpg",
    "link": "https://www.imdb.com/title/tt0468569/"
  },
    ...
]
```
