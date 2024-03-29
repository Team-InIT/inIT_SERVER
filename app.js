//모듈 및 패키지 임포트
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const bufferImage = require('buffer-image');
const dotenv = require('dotenv');
const moment = require('moment');

//REDIS
const redis = require('redis');
const RedisStore = require('connect-redis')(session);

//시퀄라이저
//const { sequelize, Recruit } = require('./models');
const { sequelize } = require('./models');
const { Op, where } = require('sequelize');
const Member = require('./models/members');
const ProjectInfo = require('./models/projectinfo');
const Recruit = require("./models/recruit");
const Feed = require('./models/feed');
const Zzim = require('./models/zzim');
const Todo = require('./models/todo');
const Evaluation = require('./models/evaluation');
//const { where } = require('sequelize/types');
//const { Model } = require('sequelize/types');

//dotenv 패키지 사용
dotenv.config();
//redis
const redisClient = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_PASSWORD
});

//express 객체 생성
const app = express();

app.set('port', process.env.PORT || 3006);


//데이터베이스 연결
sequelize.sync({ force: false })
    .then(() => {
        console.log('데이터베이스 연결');
    })
    .catch((err) => {
        console.error(err);
    })

//미들웨어 등록
app.use(cookieParser(process.env.COOKIE_SECRET));
const sessionOption = {
    resave: false,
    saveUninitialize: false,
    secret: process.env.COOKIE_SECRET,
    cookie: {
        httpOnly: true,
        secure: false,
    },
    store: new RedisStore({ client: redisClient }),
};

if(process.env.NODE_ENV === 'production') {
    sessionOption.proxy = true;
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}
app.use(session(sessionOption));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
/*
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.COOKIE_SECRET,
    cookie: {
        httpOnly: true,
        secure: false,
    },
    name: 'session-cookie',
}));*/

//이미지 저장 서버 디스크 생성
try {
    fs.readdirSync('uploads');
    console.log("이제 uploads 폴더에 이미지가 저장됩니다");
} catch (err) {
    console.log("uploads 폴더가 없어 uploads 폴더를 생성합니다");
    fs.mkdirSync('uploads');
}
//이미지 저장 형식
const upload = multer({
    storage: multer.diskStorage({
        destination(req, file, done) {
            console.log("경로 설정 완");
            done(null, 'uploads/');
        },
        filename(req, file, done) {
            const ext = path.extname(file.originalname);
            console.log("파일명 설정 완");
            done(null, path.basename(file.originalname, ext) + Date.now() + ext);
        }
    })
});
//이미지 파일 비트맵으로 변환
async function readImageFile(file) {
    fs.readFile(file, (err, data) => {
        if (err) { throw err; }
        const buf = new Buffer.from(data);
        return buf;
    });
}


//서버 실행
//각자 ip주소 넣기, port: 3006 변경 금지!
//학교: 172.18.9.151  집: 172.30.1.25

app.listen(3006, '172.18.0.141', (err) => {
    if (!err) {
        console.log('server start in 172.18.0.141');
    }
});
/*
app.listen(app.get('port', ()=>{
    if(!err) {
        console.log('server start');
    }
}));*/


//앱 로그인
app.post('/login', function (req, res) {
    console.log(req);
    var mID = req.body.mID;
    var mPW = req.body.mPW;
    var message = "";
    console.log(mID);
    Member.findAll({
        where: {
            mID: mID
        },
    })
        .then((members) => {
            if (members.length == 0) {
                members = null;
                message = "존재하지 않는 아이디입니다.";
                res.json({
                    'code': 201,
                    'member': members,
                    'message': message,
                })
            }
            else if (members[0].mPW != mPW) {
                members = null;
                message = "비밀번호가 틀렸습니다.";
                res.json({
                    'code': 202,
                    'member': members,
                    'message': message,
                })
            }
            else if (members[0].mPW == mPW) {
                if (members[0].mApproval == 0) {
                    members = null;
                    message = "승인 대기 중입니다.";
                    res.json({
                        'code': 203,
                        'member': members,
                        'message': message,
                    })
                }
                /*
                else if(members[0].mApproval == 2) {
                    members = null;
                    message = "탈퇴한 계정입니다.";
                    res.json({
                        'code': 204,
                        'member': members,
                        'message': message,
                    })
                }*/
                else if (members[0].mApproval == 1) {
                    message = members[0].mName + "님 환영합니다.";
                    res.json({
                        'code': 204,
                        'member': members,
                        'message': message,
                    })
                }
            }
        })
        .catch((err) => {
            console.log(err);
        });
});

//회원가입
app.post('/signUp', function (req, res) {
    console.log(res);
    var mID = req.body.mID;
    var mPW = req.body.mPW;
    var mName = req.body.mName;
    var mEmail = req.body.mEmail;
    var mDept = req.body.mDept;
    var mAcademic = req.body.mAcademic;
    var mGender = req.body.mGender;
    var mPosition = req.body.mPosition;
    var mLevel = req.body.mLevel;

    Member.create({
        mType: 0,//회원유형 일단 0(일반회원) -> 회원유형 나눠지면 수정 필요!
        mID: mID,
        mPW: mPW,
        mName: mName,
        mEmail: mEmail,
        mDept: mDept,
        mAcademic: mAcademic,
        mGender: mGender,
        mPosition: mPosition,
        mLevel: mLevel,
        mApproval: 0,
    })
        .then(() => {
            var code = 201;
            message = "회원가입이 완료되었습니다.";
            res.json({
                "code": code,
                "message": message,
            })
        })
        .catch((err) => {
            console.log(err);
        });
});

//아이디 중복 확인
app.post('/idCheck', function (req, res) {
    var id = req.body.mID;
    var is_check = false;
    var message = "";

    Member.findAll({
        where: {
            mID: id,
        },
    })
        .then((result) => {
            if (result.length == 0) {//결과 없음
                message = "사용 가능한 아이디입니다.";
                is_check = true;
                res.json({
                    "code": 201,
                    "is_check": is_check,
                    "message": message
                })
            }
            else {
                message = "이미 사용 중인 아이디입니다."
                res.json({
                    "code": 202,
                    "is_check": is_check,
                    "message": message,
                })
            }
        })
        .catch((err) => {
            console.log(err);
        });
});

//회원 탈퇴
app.post('/withdraw', function (req, res) {
    var mNum = req.body.mNum;
    var is_checked = req.body.is_checked;
    var message = "";

    if (is_checked == false) {
        message = "탈퇴 확인을 완료해주세요";
        res.json({
            "code": 201,
            "message": message
        });
    }
    else {
        Member.destroy({
            where: {
                mNum: mNum
            }
        })
            .then((result) => {
                message = "탈퇴가 완료되었습니다.";
                res.json({
                    "code": 202,
                    "message": message
                })
            })
            .catch((err) => {
                console.log(err);
            })
    }
})


//프로젝트 글쓰기
app.post('/addProject', async function (req, res) {
    console.log("프로젝트: " + req);
    var pTitle = req.body.pTitle;
    var pType = req.body.pType;
    var pRecruitStart = req.body.pRecruitStart;
    var pRecruitDue = req.body.pRecruitDue;
    var pStart = req.body.pStart;
    var pDue = req.body.pDue;
    var pPlan = req.body.pPlan;
    var pDesign = req.body.pDesign;
    var pIos = req.body.pIos;
    var pAos = req.body.pAos;
    var pGame = req.body.pGame;
    var pWeb = req.body.pWeb;
    var pServer = req.body.pServer;
    var pDescription = req.body.pDescription;
    var pOnOff = req.body.pOnOff;
    var pGender = req.body.pGender;
    var pAcademic = req.body.pAcademic;
    var pPlanf = req.body.pPlanf;
    var pDesignf = req.body.pDesignf;
    var pIosf = req.body.pIosf;
    var pAosf = req.body.pAosf;
    var pGamef = req.body.pGamef;
    var pWebf = req.body.pWebf;
    var pServerf = req.body.pServerf;
    var mNum = req.body.mNum;
    var mPosition = req.body.mPosition;
    var pStack = req.body.pStack;

    var create_projectInfo = await ProjectInfo.create({
        pTitle: pTitle,
        pType: pType,
        pRecruitStart: pRecruitStart,
        pRecruitDue: pRecruitDue,
        pStart: pStart,
        pDue: pDue,
        pPlan: pPlan,
        pDesign: pDesign,
        pAos: pAos,
        pIos: pIos,
        pGame: pGame,
        pWeb: pWeb,
        pServer: pServer,
        pDescription: pDescription,
        pOnOff: pOnOff,
        pGender: pGender,
        pAcademic: pAcademic,
        pPlanf: pPlanf,
        pDesignf: pDesignf,
        pIosf: pIosf,
        pAosf: pAosf,
        pGamef: pGamef,
        pWebf: pWebf,
        pServerf: pServerf,
        pStatus: 0,
        mNum: mNum,
        pStack: pStack,
    });

    var create_recruit = await Recruit.create({
        mNum: mNum,
        pNum: create_projectInfo.pNum,
        rApproval: 1,
        rPosition: mPosition
    });

    res.json({
        "code": 201,
        "message": "공고등록이 완료되었습니다."
    });

});

//프로젝트 상세보기
app.post('/detailProject', async function (req, res) {
    var pNum = req.body.pNum;
    var mNum = req.body.mNum;
    console.log("요청: " + mNum);

    //현재 보고 있는 프로젝트에 승인된 사람인가요?
    var approve = await Recruit.findOne({
        attributes: ["rApproval"],
        where: {
            mNum: mNum,
            pNum: pNum
        }
    });
    var isApproval;
    if (approve == null) {
        isApproval = false;
    }
    else {
        switch (approve.rApproval) {
            case 0:
                isApproval = false;
                break;
            case 1:
                isApproval = true;
                break;
        }
    }

    //프로젝트 정보
    var projectInfo = await ProjectInfo.findOne({
        where: { pNum: pNum }
    });
    //스택 파싱
    if (projectInfo.pStack != null) {
        var stacks = projectInfo.pStack.split(',');
        projectInfo.pStack = stacks;
    }
    //날짜 정보
    var projectState;
    if (projectInfo.pState == 0) {//모집중
        var today = moment();
        var pRecruitDue = moment(projectInfo.pRecruitDue);
        var due = pRecruitDue.diff(today, 'days')
        projectState = "D-" + due;
    }
    else if (projectInfo.pState == 1) {//프로젝트 진행중
        projectState = "ING";
    }
    else if (projectInfo.pState == 2) {//프로젝트 종료
        projectState = "FIN";
    }
    //작성자 정보
    var writer = projectInfo.mNum;
    var writerInfo = await Member.findOne({
        attributes: ['mNum', 'mName', 'mPosition', 'mPhoto'],
        where: {
            mNum: writer
        }
    });

    detailInfo = {
        projectInfo: projectInfo,
        projectState: projectState,
        writerInfo: writerInfo
    };

    res.json({
        "code": 201,
        "isApproval": isApproval,
        "detailInfo": detailInfo
    });
});

//모집중 프로젝트 전체보기
app.get('/recrutingProject', async function (req, res) {
    //프로젝트 아이템 내용
    const recruitingProject = await ProjectInfo.findAll({
        where: {
            pState: 0
        },
        include: [{
            attributes: ['mNum', 'mName'],
            model: Member
        }]
    });

    var projectInfo = [];
    var projectState;
    for (var i = 0; i < recruitingProject.length; i++) {
        var today = moment();
        var pRecruitDue = moment(recruitingProject[i].pRecruitDue);
        var due = pRecruitDue.diff(today, 'days')
        projectState = "D-" + due;
        projectInfo[i] = {
            recruitingProject: recruitingProject[i],
            projectState: projectState
        };
    }

    res.json({
        "code": 201,
        "projectInfo": projectInfo
    });

});

//모집 완료 프로젝트 전체보기
app.get('/notRecruitingProject', async function (req, res) {
    //프로젝트 아이템 내용
    const notRecruitingProject = await ProjectInfo.findAll({
        where: {
            [Op.or]: [{ pState: 1 }, { pState: 2 }]
        },
        include: [{
            attributes: ['mNum', 'mName'],
            model: Member
        }]
    });

    var projectInfo = [];
    var projectState;
    for (var i = 0; i < notRecruitingProject.length; i++) {
        if (notRecruitingProject[i].pState == 1) {
            projectState = "ING";
        }
        else if (notRecruitingProject[i].pState == 2) {
            projectState = "FIN";
        }
        projectInfo[i] = {
            notRecruitingProject: notRecruitingProject[i],
            projectState: projectState
        };
    }

    res.json({
        "code": 201,
        "projectInfo": projectInfo,
    });
});

//파트원 전체 보기
app.get('/userAll', async function (req, res) {
    const userInfo = await Member.findAll({
        attributes: ['mNum', 'mName', 'mPosition', 'mIntroduction', 'mPhoto'],
        limit: 30
    });

    res.json({
        "code": 201,
        "userList": userInfo
    });
});

//모집중인 프로젝트 검색
app.post('/searchIng', async function (req, res) {
    var keyword = req.body.keyword;

    var result = await ProjectInfo.findAll({
        where: {
            pState: 0,
            [Op.or]: [
                { pTitle: { [Op.like]: '%' + keyword + '%' } },
                { pDescription: { [Op.like]: '%' + keyword + '%' } }
            ]
        },
        include: [{
            attributes: ['mNum', 'mName'],
            model: Member
        }]
    });

    var projectInfo = [];
    var projectState;
    for (var i = 0; i < result.length; i++) {
        var today = moment();
        var pRecruitDue = moment(result[i].pRecruitDue);
        var due = pRecruitDue.diff(today, 'days')
        projectState = "D-" + due;
        projectInfo[i] = {
            recruitingProject: result[i],
            projectState: projectState
        };
    }

    res.json({
        "code": 201,
        "projectInfo": projectInfo
    });
});

//모집완료 프로젝트 검색
app.post('/searchEd', async function (req, res) {
    var keyword = req.body.keyword;

    var reslut = await ProjectInfo.findAll({
        where: {
            pState: {
                [Op.or]: [1, 2]
            },
            [Op.or]: [
                { pTitle: { [Op.like]: '%' + keyword + '%' } },
                { pDescription: { [Op.like]: '%' + keyword + '%' } }
            ]
        },
        include: [{
            attributes: ['mNum', 'mName'],
            model: Member
        }]
    });

    var projectInfo = [];
    var projectState;
    for (var i = 0; i < reslut.length; i++) {
        if (reslut[i].pState == 1) {
            projectState = "ING";
        }
        else if (reslut[i].pState == 2) {
            projectState = "FIN";
        }
        projectInfo[i] = {
            notRecruitingProject: reslut[i],
            projectState: projectState
        };
    }

    res.json({
        "code": 201,
        "projectInfo": projectInfo
    });
});

//프로젝트 공고 삭제
app.post('/delProject', function (req, res) {
    var pNum = req.body.pNum;

    ProjectInfo.destroy({ where: { pNum: pNum } })
        .then(() => {
            var message = "프로젝트 모집 공고가 삭제되었습니다.";
            res.json({
                "code": 201,
                "message": message
            })
        })
        .catch((err) => {
            console.log(err);
        });
});

//프로젝트 지원
app.post('/apply', async function (req, res) {
    var mNum = req.body.mNum;
    var pNum = req.body.pNum;
    var rPosition = req.body.rPosition;
    console.log("지원자"+ mNum + "프로젝트"+pNum + "포지션"+rPosition);

    var alreadyApply = await Recruit.findAll({
        where: {
            mNum: mNum,
            pNum: pNum
        }
    });
    console.log(alreadyApply.rNum);
    if (alreadyApply.length != 0) {
        var message = "이미 지원한 프로젝트입니다";
        console.log(message)
        res.json({
            "code": 202,
            "message": message
        });
    }
    else {
        console.log("지원 성공");
        Recruit.create({
            mNum: mNum,
            pNum: pNum,
            rApproval: 0,
            rPosition: rPosition
        })
            .then(() => {
                var message = "지원이 완료되었습니다";
                res.json({
                    "code": 201,
                    "message": message
                })
            })
            .catch((err) => {
                console.log(err);
            });
    }

});

//홈
app.post('/home', async function (req, res) {
    var mNum = req.body.mNum;
    var mPosition = req.body.mPosition;
    var mLevel = req.body.mLevel;
    var list_belong = [];
    //소속 플젝
    var projectInfoList1 = await ProjectInfo.findAll({
        include: [{
            where: {
                mNum: mNum,
                rApproval: 1
            },
            model: Recruit,
        }],
        include: [{
            attributes: ['mNum', 'mName'],
            model: Member
        }]
    });

    if (projectInfoList1.length < 3) {
        list_belong = projectInfoList1;
    }
    else {
        list_belong = projectInfoList1.slice(0, 3);
    }

    //날짜 정보
    var projectState;
    var list_join = [];
    for (var i = 0; i < list_belong.length; i++) {
        if (list_belong[i].pState == 0) {//모집중
            var today = moment();
            var pRecruitDue = moment(list_belong[i].pRecruitDue);
            var due = pRecruitDue.diff(today, 'days')
            projectState = "D-" + due;
        }
        else if (list_belong[i].pState == 1) {//프로젝트 진행중
            projectState = "ING";
        }
        else if (list_belong[i].pState == 2) {//프로젝트 종료
            projectState = "FIN";
        }
        list_join[i] = {
            list_belong: list_belong[i],
            projectState: projectState
        }
    }


    //추천 플젝
    var projectInfoList2 = [];
    var list_recommend = [];
    switch (mPosition) {
        case 0:
            projectInfoList2 = await ProjectInfo.findAll({
                where: {
                    pPlan: { [Op.gte]: 1 },
                    [Op.or]: [{ pPlanf: null }, { pPlanf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 1:
            projectInfoList2 = await ProjectInfo.findAll({
                where: {
                    pDesign: { [Op.gte]: 1 },
                    [Op.or]: [{ pDesignf: null }, { pDesignf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 2:
            projectInfoList2 = await ProjectInfo.findAll({
                where: {
                    pIos: { [Op.gte]: 1 },
                    [Op.or]: [{ pIosf: null }, { pIosf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 3:
            projectInfoList2 = await ProjectInfo.findAll({
                where: {
                    pAos: { [Op.gte]: 1 },
                    [Op.or]: [{ pAosf: null }, { pAosf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 4:
            projectInfoList2 = await ProjectInfo.findAll({
                where: {
                    pGame: { [Op.gte]: 1 },
                    [Op.or]: [{ pGamef: null }, { pGamef: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 5:
            projectInfoList2 = await ProjectInfo.findAll({
                where: {
                    pWeb: { [Op.gte]: 1 },
                    [Op.or]: [{ pWebf: null }, { pWebf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 6:
            projectInfoList2 = await ProjectInfo.findAll({
                where: {
                    pServer: { [Op.gte]: 1 },
                    [Op.or]: [{ pServerf: null }, { pServerf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
    };
    if (projectInfoList2.length < 3) {
        list_recommend = projectInfoList2;
    }
    else {
        list_recommend = projectInfoList2.slice(0, 3);
    }

    //날짜 정보
    var projectState2;
    var listRecommend = [];
    for (var i = 0; i < list_recommend.length; i++) {
        if (list_recommend[i].pState == 0) {//모집중
            var today = moment();
            var pRecruitDue = moment(list_recommend[i].pRecruitDue);
            var due = pRecruitDue.diff(today, 'days')
            projectState2 = "D-" + due;
        }
        else if (list_recommend[i].pState == 1) {//프로젝트 진행중
            projectState2 = "ING";
        }
        else if (list_recommend[i].pState == 2) {//프로젝트 종료
            projectState2 = "FIN";
        }
        listRecommend[i] = {
            listRecommend: list_recommend[i],
            projectState2: projectState2
        }
    }

    res.json({
        "code": 201,
        "list_join": list_join,
        "list_recommend": listRecommend
    });
});


//소속 프로젝트 전체 보기
app.post('/getbelongedProject', async function (req, res) {
    var mNum = req.body.mNum; //로그인 한 사용자

    //로그인한 사용자가 소속된 프로젝트 정보
    var pInfo = await ProjectInfo.findAll({
        attributes: ['pNum', 'pTitle', 'pType', 'pOnOff', 'pStart', 'pDue', 'pState', 'mNum'],
        include: [{
            model: Recruit,
            where: {
                mNum: mNum,
                rApproval: 1
            },
        }],
        include: [{
            attributes: ['mNum', 'mName'],
            model: Member
        }]
    });

    //날짜 정보
    var projectState;
    var list_join = [];
    for (var i = 0; i < pInfo.length; i++) {
        if (pInfo[i].pState == 0) {//모집중
            var today = moment();
            var pRecruitDue = moment(pInfo[i].pRecruitDue);
            var due = pRecruitDue.diff(today, 'days')
            projectState = "D-" + due;
        }
        else if (pInfo[i].pState == 1) {//프로젝트 진행중
            projectState = "ING";
        }
        else if (pInfo[i].pState == 2) {//프로젝트 종료
            projectState = "FIN";
        }
        list_join[i] = {
            pInfo: pInfo[i],
            projectState: projectState
        }
    }


    res.json({
        "list_join": list_join
    });

});

//추천 프로젝트 전체 보기
app.post('/getRecommenedProject', async function (req, res) {
    var mPosition = req.body.mPosition;
    var mLevel = req.body.mLevel;
    var pInfo = [];

    switch (mPosition) {
        case 0:
            pInfo = await ProjectInfo.findAll({
                where: {
                    pPlan: { [Op.gte]: 1 },
                    [Op.or]: [{ pPlanf: null }, { pPlanf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 1:
            pInfo = await ProjectInfo.findAll({
                where: {
                    pDesign: { [Op.gte]: 1 },
                    [Op.or]: [{ pDesignf: null }, { pDesignf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 2:
            pInfo = await ProjectInfo.findAll({
                where: {
                    pIos: { [Op.gte]: 1 },
                    [Op.or]: [{ pIosf: null }, { pIosf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 3:
            pInfo = await ProjectInfo.findAll({
                where: {
                    pAos: { [Op.gte]: 1 },
                    [Op.or]: [{ pAosf: null }, { pAosf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 4:
            pInfo = await ProjectInfo.findAll({
                where: {
                    pGame: { [Op.gte]: 1 },
                    [Op.or]: [{ pGamef: null }, { pGamef: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 5:
            pInfo = await ProjectInfo.findAll({
                where: {
                    pWeb: { [Op.gte]: 1 },
                    [Op.or]: [{ pWebf: null }, { pWebf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
        case 6:
            pInfo = await ProjectInfo.findAll({
                where: {
                    pServer: { [Op.gte]: 1 },
                    [Op.or]: [{ pServerf: null }, { pServerf: { [Op.gte]: mLevel } }],
                    pState: 0
                },
                include: [{
                    attributes: ['mNum', 'mName'],
                    model: Member
                }]
            });
            break;
    };

    //날짜 정보
    var projectState;
    var list_recommend = [];
    for (var i = 0; i < pInfo.length; i++) {
        if (pInfo[i].pState == 0) {//모집중
            var today = moment();
            var pRecruitDue = moment(pInfo[i].pRecruitDue);
            var due = pRecruitDue.diff(today, 'days')
            projectState = "D-" + due;
        }
        else if (pInfo[i].pState == 1) {//프로젝트 진행중
            projectState = "ING";
        }
        else if (pInfo[i].pState == 2) {//프로젝트 종료
            projectState = "FIN";
        }
        list_recommend[i] = {
            pInfo: pInfo[i],
            projectState: projectState
        }
    }

    res.json({
        "list_recommend": list_recommend,
    });
});

//마이페이지 내 정보 불러오기
app.post('/myPage', async function (req, res) {
    var mNum = req.body.mNum;
    console.log("로그인된 사용자: " + mNum);

    var mInfo = await Member.findOne({
        where: {
            mNum: mNum
        }
    });

    //스택 파싱
    if (mInfo.mStacks != null) {
        var stacks = mInfo.mStacks.split(',');
        mInfo.mStacks = stacks;
    }

    //const stack = stacks.reverse().join();

    res.json({
        "code": 201,
        "mInfo": mInfo
    });
});

//기본정보 수정
app.post('/editBasicInfo', async function (req, res) {
    var mNum = req.body.mNum;
    var mEmail = req.body.mEmail;
    var mDept = req.body.mDept;
    var mAcademic = req.body.mAcademic;
    var mGender = req.body.mGender;

    Member.update(
        {
            mEmail: mEmail,
            mDept: mDept,
            mAcademic: mAcademic,
            mGender: mGender
        },
        {
            where: {
                mNum: mNum
            }
        })
        .then(() => {
            var message = "회원정보가 수정되었습니다."
            var result = true;

            res.json({
                "code": 201,
                "message": message,
                "result": result
            });
        })
        .catch((err) => {
            console.log(err);
        })
});

//링크 수정
app.post('/updateLink', async function (req, res) {
    var mNum = req.body.mNum;
    var mGit = req.body.mGit;
    var mNotion = req.body.mNotion;
    var mBlog = req.body.mBlog;

    Member.update({
        mGit: mGit,
        mNotion: mNotion,
        mBlog: mBlog
    }, {
        where: {
            mNum: mNum
        }
    })
        .then(() => {
            var message = "링크 정보가 수정되었습니다";
            var result = true;
            res.json({
                "code": 201,
                "message": message,
                "result": result
            })
        })
        .catch((err) => {
            console.log(err);
        });
});

//스택 수정
app.post('/updateStack', async function (req, res) {
    var mNum = req.body.mNum;
    var mStacks = req.body.mStacks;
    console.log(req);
    Member.update({
        mStacks: mStacks
    }, {
        where: { mNum: mNum }
    })
        .then(() => {
            var message = "스택 수정이 완료되었습니다";
            var result = true;
            res.json({
                "code": 201,
                "result": result,
                "message": message
            });
        })
        .catch((err) => {
            console.log(err);
        });
});

//프로필 수정
app.post('/updateProfile', upload.single('file'), async function (req, res) {
    var mNum = req.body.mNum;
    var mName = req.body.mName;
    var mPosition = req.body.mPosition;
    var mLevel = req.body.mLevel;
    var mIntroduction = req.body.mIntroduction;

    var imgData = readImageFile('./uploads/' + req.file.filename);

    Member.update({
        mName: mName,
        mPosition: mPosition,
        mLevel: mLevel,
        mIntroduction: mIntroduction,
        mPhoto: imgData
    }, {
        where: { mNum: mNum }
    })
        .then(() => {
            var message = "프로필이 수정되었습니다."
            var result = true;
            res.json({
                "code": 201,
                "message": message,
                "result": result
            })
        })
        .catch((err) => {
            console.log(err);
        });
});

//마이페이지: 프로젝트 개수
app.post('/countProject', async function (req, res) {
    var mNum = req.body.mNum;

    var joinedProject = await Recruit.findAll({
        include: [{
            model: ProjectInfo,
            where: {[Op.or]: [{ pState: 1 }, { pState: 2 }]}
        }],
        where: {
            mNum: mNum,
            rApproval: 1
        }
    });


    var uploadProject = await ProjectInfo.findAll({
        where: {
            mNum: mNum
        }
    });

    var standBy = await Recruit.findAll({
        where: {
            mNum: mNum,
            rApproval: 0
        }
    });

    var zzimProject = await Zzim.findAll({
        where: {
            mNum: mNum
        }
    });

    res.json({
        "code": 201,
        "join": joinedProject.length,
        "upload": uploadProject.length,
        "disapproval": standBy.length,
        "zzim": zzimProject.length
    });
});

//마이페이지: 내 평가 보기
app.post('/myEvaluation', async function (req, res) {
    var mNum = req.body.mNum;

    var myEvaluations = await Evaluation.findAll({
        attributes: ['eNum', 'eComment', 'mNum'],
        where: { ePerson: mNum },
        include: [{
            attributes: ['pNum', 'pTitle'],
            model: ProjectInfo
        }]
    });

    var writer = [];
    for (var i = 0; i < myEvaluations.length; i++) {
        writer[i] = await Member.findOne({
            attributes: ['mNum', 'mName', 'mPhoto'],
            where: { mNum: myEvaluations[i].mNum }
        });
    }

    res.json({
        "code": 201,
        "myEvaluations": myEvaluations,
        "writer": writer
    });
});

//피드 작성용 바텀시트
app.post('/finishedProject', async function (req, res) {
    var mNum = req.body.mNum;

    var project = await ProjectInfo.findAll({
        attributes: ['pNum', 'pTitle'],
        include: [{
            where: {
                mNum: mNum,
                rApproval: 1,
            },
            model: Recruit
        }],
        where: {
            pState: 2
        }
    });

    res.json({
        "code": 201,
        "project": project
    })
});

//피드 작성
app.post('/addFeed', upload.single('file'), async function (req, res) {
    console.log("req.file: " + req.file);
    var fTitle = req.body.fTitle;
    var fType = req.body.fType;
    var fDescription = req.body.fDescription;
    var fLink = req.body.fLink;
    var mNum = req.body.mNum;
    var pNum = req.body.pNum;


    //이미지 파일 db에 넣기
    var imgData = readImageFile('./uploads/' + req.file.filename);
    var url = req.file.path

    Feed.create({
        fTitle: fTitle,
        fType: fType,
        fPhoto: imgData,
        fDescription: fDescription,
        fLink: fLink,
        mNum: mNum,
        pNum: pNum,
        fTest: url
    })
        .then(() => {
            var message = "피드 등록이 완료되었습니다";
            res.json({
                "code": 201,
                "message": message
            })
        })
        .catch((err) => {
            console.log(err);
        })
});

//피드 삭제
app.post('/deleteFeed', async function (req, res) {
    var fNum = req.body.fNum;

    Feed.destroy({ where: { fNum: fNum } })
        .then(() => {
            var message = "피드가 삭제되었습니다";
            res.json({
                "code": 201,
                "message": message
            })
        })
        .catch((err) => {
            console.log(err);
        })
});

//피드 전체 보기
app.get('/getAllFeed', async function (req, res) {
    var feeds = await Feed.findAll({
        attributes: ['fNum', 'fTitle', 'fPhoto', 'fTest']
    });

    res.json({
        "code": 201,
        "feeds": feeds
    });
});

//피드 상세 보기
app.post('/detailFeed', async function (req, res) {
    var fNum = req.body.fNum;

    //피드 정보
    var feedInfo = await Feed.findOne({
        include: [{
            attributes: ['mNum', 'mName', 'mPhoto'],
            model: Member
        }],
        where: { fNum: fNum }
    });

    //방법1
    /*
    const imageData = feedInfo.fPhoto;
    console.log(imageData);
    const result = bufferImage(imageData);
    */
    const imageData = feedInfo.fPhoto;
    console.log(imageData);

    res.json({
        "code": 201,
        "feedInfo": feedInfo,
        //"img": imageData['data']
    });
});

//작성자 - 팀원 확인: 기획
app.post('/myCrewPlan', async function(req,res){
    var pNum = req.body.pNum

    var approvedPlan = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 0,
                rApproval: 1
            }
        }]
    });

    var waitingPlan = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 0,
                rApproval: 0
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedPlan": approvedPlan,
        "waitingPlan": waitingPlan
    });
});

//작성자 - 팀원 확인: 디자인
app.post('/myCrewDesign', async function(req,res){
    var pNum = req.body.pNum

    var approvedDesign = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 1,
                rApproval: 1
            }
        }]
    });

    var waitingDesign = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 1,
                rApproval: 0
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedDesign": approvedDesign,
        "waitingDesign": waitingDesign
    });
});

//작성자 - 팀원 확인: ios
app.post('/myCrewIos', async function(req,res){
    var pNum = req.body.pNum

    var approvedIos = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 2,
                rApproval: 1
            }
        }]
    });

    var waitingIos = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 2,
                rApproval: 0
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedIos": approvedIos,
        "waitingIos": waitingIos
    });
});

//작성자 - 팀원 확인: aos
app.post('/myCrewAos', async function(req,res){
    var pNum = req.body.pNum

    var approvedAos = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 3,
                rApproval: 1
            }
        }]
    });

    var waitingAos = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 3,
                rApproval: 0
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedAos": approvedAos,
        "waitingAos": waitingAos
    });
});

//작성자 - 팀원 확인: web
app.post('/myCrewWeb', async function(req,res){
    var pNum = req.body.pNum

    var approvedWeb = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 4,
                rApproval: 1
            }
        }]
    });

    var waitingWeb = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 4,
                rApproval: 0
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedWeb": approvedWeb,
        "waitingWeb": waitingWeb
    });
});

//작성자 - 팀원 확인: 게임
app.post('/myCrewGame', async function(req,res){
    var pNum = req.body.pNum

    var approvedGame = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 5,
                rApproval: 1
            }
        }]
    });

    var waitingGame = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 5,
                rApproval: 0
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedGame": approvedGame,
        "waitingGame": waitingGame
    });
});

//작성자 - 팀원 확인: 서버
app.post('/myCrewServer', async function(req,res){
    var pNum = req.body.pNum

    var approvedServer = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 6,
                rApproval: 1
            }
        }]
    });

    var waitingServer = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 6,
                rApproval: 0
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedServer": approvedServer,
        "waitingServer": waitingServer
    });
});

//프로젝트 승인해주기
app.post('/approve', async function(req,res){
    var mNum = req.body.mNum; // 작성자
    var pNum = req.body.pNum; //현재 프로젝트
    var apply = req.body.apply; //지원자 mNum

    //작성자 맞는지 확인
    var thisproject = await ProjectInfo.findOne({
        attributes: ['mNum'],
        where: {pNum: pNum}
    });

    if(thisproject.mNum == mNum) {//작성자가 맞으면
        Recruit.update({
            rApproval: 1
        }, {
            where: {
                mNum: apply,
                pNum: pNum
            }
        })
        .then(()=>{
            var message = "승인되었습니다";
            res.json({
                "code": 201,
                "message": message
            });
        })
        .catch((err)=>{
            console.log(err);
        });
    }
    else{//작성자가 아니면
        var message = "승인 권한이 없습니다"
        res.json({
            "code": 202,
            "message": message
        });
    }
});

//승인 거부
app.post('/reject', async function(req,res){
    var mNum = req.body.mNum; // 작성자
    var pNum = req.body.pNum; //현재 프로젝트
    var apply = req.body.apply; //지원자 mNum

    //작성자 맞는지 확인
    var thisproject = await ProjectInfo.findOne({
        attributes: ['mNum'],
        where: {pNum: pNum}
    });

    if(thisproject.mNum == mNum) {//작성자가 맞으면
        Recruit.destroy({
            where: {
                mNum: apply,
                pNum: pNum
            }
        })
        .then(()=>{
            var message = "거절되었습니다";
            res.json({
                "code": 201,
                "message": message
            });
        })
        .catch((err)=>{
            console.log(err);
        });
    }
    else{//작성자가 아니면
        var message = "거절 권한이 없습니다"
        res.json({
            "code": 202,
            "message": message
        });
    }
})

//승인된 팀원 정보 - 전체
app.post('/teamMember', async function (req, res) {
    var pNum = req.body.pNum;

    var approvedPlan = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 0,
                rApproval: 1
            }
        }]
    });
    var approvedDesign = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 1,
                rApproval: 1
            }
        }]
    });
    var approvedIos = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 2,
                rApproval: 1
            }
        }]
    });
    var approvedAos = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 3,
                rApproval: 1
            }
        }]
    });
    var approvedWeb = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 4,
                rApproval: 1
            }
        }]
    });

    var approvedGame = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 5,
                rApproval: 1
            }
        }]
    });
    var approvedServer = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 6,
                rApproval: 1
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedPlan": approvedPlan,
        "approvedDesign": approvedDesign,
        "approvedWeb": approvedWeb,
        "approvedAos": approvedAos,
        "approvedIos": approvedIos,
        "approvedGame": approvedGame,
        "approvedServer": approvedServer
    });
});

//승인된 팀원 정보 - 기획
app.post('/memberPlanner', async function (req, res) {
    var pNum = req.body.pNum;

    var approvedPlan = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 0,
                rApproval: 1
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedPlan": approvedPlan
    });
});

//승인된 팀원 정보 - 디자인
app.post('/memberDesigner', async function (req, res) {
    var pNum = req.body.pNum;

    var approvedDesign = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 1,
                rApproval: 1
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedDesign": approvedDesign
    });
});

//승인된 팀원 정보 - ios
app.post('/memberIos', async function (req, res) {
    var pNum = req.body.pNum;

    var approvedIos = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 2,
                rApproval: 1
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedIos": approvedIos
    });
});

//승인된 팀원 정보 - aos
app.post('/memberAos', async function (req, res) {
    var pNum = req.body.pNum;

    var approvedAos = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 3,
                rApproval: 1
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedAos": approvedAos
    });
});

//승인된 팀원 정보 - 웹
app.post('/memberWeb', async function (req, res) {
    var pNum = req.body.pNum;

    var approvedDesign = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 4,
                rApproval: 1
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedDesign": approvedDesign
    });
});
//승인된 팀원 정보 - 게임
app.post('/memberGame', async function (req, res) {
    var pNum = req.body.pNum;

    var approvedGame = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 5,
                rApproval: 1
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedGame": approvedGame
    });
});

//승인된 팀원 정보 - 서버
app.post('/memberServer', async function (req, res) {
    var pNum = req.body.pNum;

    var approvedServer = await Member.findAll({
        attributes: ['mNum', 'mName', 'mEmail', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rPosition: 6,
                rApproval: 1
            }
        }]
    });

    res.json({
        "code": 201,
        "approvedServer": approvedServer
    });
});

//마이페이지 - 찜한 프로젝트 조회
app.post('/myZzimList', async function (req, res) {
    var mNum = req.body.mNum;

    var projectInfoList = await ProjectInfo.findAll({
        include: [{
            model: Zzim,
            where: { mNum: mNum }
        }]
    });
    //작성자
    var writer = [];
    for (var i = 0; i < projectInfoList.length; i++) {
        writer[i] = await Member.findOne({
            attributes: ['mNum', 'mName'],
            where: { mNum: projectInfoList[i].mNum }
        });
    }
    res.json({
        "code": 201,
        "projectInfoList": projectInfoList,
        "writer": writer
    });
});

//승인 대기중인 공고
app.post('/myWaitingApproval', async function (req, res) {
    var mNum = req.body.mNum;

    var projectInfoList = await ProjectInfo.findAll({
        include: [{
            model: Recruit,
            where: {
                mNum: mNum,
                rApproval: 0
            }
        }],
        where: {
            pState: 0
        }
    });
    //작성자
    var writer = [];
    for (var i = 0; i < projectInfoList.length; i++) {
        writer[i] = await Member.findOne({
            attributes: ['mNum', 'mName'],
            where: { mNum: projectInfoList[i].mNum }
        });
    }

    res.json({
        "code": 201,
        "projectInfoList": projectInfoList,
        "writer": writer
    });
});

//참여 중인 프로젝트
app.post('/myIngProject', async function (req, res) {
    var mNum = req.body.mNum;

    var projectInfoList = await ProjectInfo.findAll({
        include: [{
            model: Recruit,
            where: {
                mNum: mNum,
                rApproval: 1
            }
        }],
        where: { pState: 1 }
    });

    //작성자
    var writer = [];
    for (var i = 0; i < projectInfoList.length; i++) {
        writer[i] = await Member.findOne({
            attributes: ['mNum', 'mName'],
            where: { mNum: projectInfoList[i].mNum }
        });
    }

    res.json({
        "code": 201,
        "projectInfoList": projectInfoList,
        "writer": writer
    });
});

//참여 완료 프로젝트
app.post('/myEndProject', async function (req, res) {
    var mNum = req.body.mNum;
    var projectInfoList = await ProjectInfo.findAll({
        include: [{
            model: Recruit,
            where: {
                mNum: mNum,
                rApproval: 1
            }
        }],
        where: { pState: 2 }
    });
    //작성자
    var writer = [];
    for (var i = 0; i < projectInfoList.length; i++) {
        writer[i] = await Member.findOne({
            attributes: ['mNum', 'mName'],
            where: { mNum: projectInfoList[i].mNum }
        });
    }

    res.json({
        "code": 201,
        "projectInfoList": projectInfoList,
        "writer": writer
    });
});

//업로드한 프로젝트
app.post('/myUploadProject', async function (req, res) {
    var mNum = req.body.mNum;

    var projectInfoList = await ProjectInfo.findAll({
        where: { mNum: mNum }
    });

    res.json({
        "code": 201,
        "projectInfoList": projectInfoList
    });
});

//내가 속한 프로젝트의 피드
app.post('/myFeeds', async function (req, res) {
    var mNum = req.body.mNum;

    var pNums = await ProjectInfo.findAll({
        attributes: ['pNum'],
        include: [{
            model: Recruit,
            where: {
                mNum: mNum,
                rApproval: 1
            }
        }],
        where: { pState: 2 }
    });

    var feeds = [];
    for (var i = 0; i < pNums.length; i++) {
        var feed_project = await Feed.findOne({
            attributes: ['fNum', 'fTitle', 'fTest'],
            where: { pNum: pNums[i].pNum }
        });
        feeds[i] = feed_project;
    }

    res.json({
        "code": 201,
        "Feeds": feeds
    });
});

//투두 작성용 팀원 조회
app.post('/todoMember', async function (req, res) {
    var part = req.body.part;
    var pNum = req.body.pNum;
    var members = [];
    switch (part) {
        case 0:
            members = await Member.findAll({
                attributes: ['mNum', 'mName', 'mPhoto'],
                include: [{
                    model: Recruit,
                    where: {
                        pNum: pNum,
                        rPosition: 0,
                        rApproval: 1
                    }
                }]
            });
            break;
        case 1:
            members = await Member.findAll({
                attributes: ['mNum', 'mName', 'mPhoto'],
                include: [{
                    model: Recruit,
                    where: {
                        pNum: pNum,
                        rPosition: 1,
                        rApproval: 1
                    }
                }]
            });
            break;
        case 2:
            members = await Member.findAll({
                attributes: ['mNum', 'mName', 'mPhoto'],
                include: [{
                    model: Recruit,
                    where: {
                        pNum: pNum,
                        rPosition: 2,
                        rApproval: 1
                    }
                }]
            });
            break;
        case 3:
            members = await Member.findAll({
                attributes: ['mNum', 'mName', 'mPhoto'],
                include: [{
                    model: Recruit,
                    where: {
                        pNum: pNum,
                        rPosition: 3,
                        rApproval: 1
                    }
                }]
            });
            break;
        case 4:
            members = await Member.findAll({
                attributes: ['mNum', 'mName', 'mPhoto'],
                include: [{
                    model: Recruit,
                    where: {
                        pNum: pNum,
                        rPosition: 4,
                        rApproval: 1
                    }
                }]
            });
            break;
        case 5:
            members = await Member.findAll({
                attributes: ['mNum', 'mName', 'mPhoto'],
                include: [{
                    model: Recruit,
                    where: {
                        pNum: pNum,
                        rPosition: 5,
                        rApproval: 1
                    }
                }]
            });
            break;
        case 6:
            members = await Member.findAll({
                attributes: ['mNum', 'mName', 'mPhoto'],
                include: [{
                    model: Recruit,
                    where: {
                        pNum: pNum,
                        rPosition: 6,
                        rApproval: 1
                    }
                }]
            });
            break;
    };

    res.json({
        "code": 201,
        "members": members
    });
});

//투두 작성
app.post('/addTodo', async function (req, res) {
    var tTodo = req.body.tTodo;
    var tPart = req.body.tPart;
    var tDday = req.body.tDday;
    var mNums = req.body.mNums;
    var pNum = req.body.pNum;

    Todo.create({
        tTodo: tTodo,
        tPart: tPart,
        tDday: tDday,
        mNums: mNums,
        tState: 0,
        pNum: pNum
    })
        .then(() => {
            var message = "투두가 등록되었습니다.";
            res.json({
                "code": 201,
                "message": message
            });
        })
        .catch((err) => {
            console.log(err);
        });
});

//투두 수정
app.post('/updateTodo', async function (req, res) {
    var tNum = req.body.tNum;
    var tTodo = req.body.tTodo;
    var tPart = req.body.tPart;
    var tDday = req.body.tDday;
    var mNums = req.body.mNums;
    var pNum = req.body.pNum;

    Todo.update({
        tTodo: tTodo,
        tPart: tPart,
        tDday: tDday,
        mNums: mNums,
        pNum: pNum
    }, {
        where: { tNum: tNum }
    })
        .then(() => {
            var message = "투두가 수정되었습니다.";
            res.json({
                "code": 201,
                "message": message
            });
        });
});

//투두 상태 업데이트
app.post('/updateTodoState', async function (req, res) {
    var tNum = req.body.tNum;

    var nowState = await Todo.findOne({
        attributes: ['tState'],
        where: { tNum: tNum }
    });

    console.log(nowState.tState);

    var updateState;
    if (nowState.tState == 0) {
        updateState = await Todo.update({
            tState: 1,
        }, {
            where: { tNum: tNum }
        });
    }
    else if (nowState.tState == 1) {
        updateState = await Todo.update({
            tState: 0,
        }, {
            where: { tNum: tNum }
        });
    }

    res.json({
        "code": 201
    });
});

//투두 삭제
app.post('/deleteTodo', async function (req, res) {
    var tNum = req.body.tNum;

    Todo.destroy({ where: { tNum: tNum } })
        .then((result) => {
            var message = "투두가 삭제되었습니다.";
            res.json({
                "code": 201,
                "message": message
            });
        })
        .catch((err) => {
            console.log(err);
        });
});

//투두 전체 보기_기획
app.post('/allTodoPlan', async function (req, res) {
    var pNum = req.body.pNum;

    var todoInfo = await Todo.findAll({
        where: {
            pNum: pNum,
            tPart: 0
        }
    });

    var todoList = [];

    //담당자
    for (var i = 0; i < todoInfo.length; i++) {
        var mNums = todoInfo[i].mNums.split(',');
        console.log('담당자 리스트: ' + mNums);
        var memberInfo = [];
        for (var j = 0; j < mNums.length; j++) {
            console.log('담당자 정보: ' + mNums[j]);
            memberInfo[j] = await Member.findOne({
                attributes: ['mNum', 'mPhoto'],
                where: { mNum: mNums[j] }
            });
        }
        todoList[i] = {
            todoInfo: todoInfo[i],
            members: memberInfo
        };
    }

    res.json({
        "code": 201,
        "todoList": todoList
    });
});
//투두 전체 보기_디자인
app.post('/allTodoDesign', async function (req, res) {
    var pNum = req.body.pNum;

    var todoInfo = await Todo.findAll({
        where: {
            pNum: pNum,
            tPart: 1
        }
    });

    var todoList = [];

    //담당자
    for (var i = 0; i < todoInfo.length; i++) {
        var mNums = todoInfo[i].mNums.split(',');
        console.log('담당자 리스트: ' + mNums);
        var memberInfo = [];
        for (var j = 0; j < mNums.length; j++) {
            console.log('담당자 정보: ' + mNums[j]);
            memberInfo[j] = await Member.findOne({
                attributes: ['mNum', 'mPhoto'],
                where: { mNum: mNums[j] }
            });
        }
        todoList[i] = {
            todoInfo: todoInfo[i],
            members: memberInfo
        };
    }

    res.json({
        "code": 201,
        "todoList": todoList
    });
});
//투두 전체 보기_ios
app.post('/allTodoIos', async function (req, res) {
    var pNum = req.body.pNum;

    var todoInfo = await Todo.findAll({
        where: {
            pNum: pNum,
            tPart: 2
        }
    });

    var todoList = [];

    //담당자
    for (var i = 0; i < todoInfo.length; i++) {
        var mNums = todoInfo[i].mNums.split(',');
        console.log('담당자 리스트: ' + mNums);
        var memberInfo = [];
        for (var j = 0; j < mNums.length; j++) {
            console.log('담당자 정보: ' + mNums[j]);
            memberInfo[j] = await Member.findOne({
                attributes: ['mNum', 'mPhoto'],
                where: { mNum: mNums[j] }
            });
        }
        todoList[i] = {
            todoInfo: todoInfo[i],
            members: memberInfo
        };
    }

    res.json({
        "code": 201,
        "todoList": todoList
    });
});
//투두 전체 보기_aos
app.post('/allTodoAos', async function (req, res) {
    var pNum = req.body.pNum;

    var todoInfo = await Todo.findAll({
        where: {
            pNum: pNum,
            tPart: 3
        }
    });

    var todoList = [];

    //담당자
    for (var i = 0; i < todoInfo.length; i++) {
        var mNums = todoInfo[i].mNums.split(',');
        console.log('담당자 리스트: ' + mNums);
        var memberInfo = [];
        for (var j = 0; j < mNums.length; j++) {
            console.log('담당자 정보: ' + mNums[j]);
            memberInfo[j] = await Member.findOne({
                attributes: ['mNum', 'mPhoto'],
                where: { mNum: mNums[j] }
            });
        }
        todoList[i] = {
            todoInfo: todoInfo[i],
            members: memberInfo
        };
    }

    res.json({
        "code": 201,
        "todoList": todoList
    });
});
//투두 전체 보기_웹
app.post('/allTodoWeb', async function (req, res) {
    var pNum = req.body.pNum;

    var todoInfo = await Todo.findAll({
        where: {
            pNum: pNum,
            tPart: 4
        }
    });

    var todoList = [];

    //담당자
    for (var i = 0; i < todoInfo.length; i++) {
        var mNums = todoInfo[i].mNums.split(',');
        console.log('담당자 리스트: ' + mNums);
        var memberInfo = [];
        for (var j = 0; j < mNums.length; j++) {
            console.log('담당자 정보: ' + mNums[j]);
            memberInfo[j] = await Member.findOne({
                attributes: ['mNum', 'mPhoto'],
                where: { mNum: mNums[j] }
            });
        }
        todoList[i] = {
            todoInfo: todoInfo[i],
            members: memberInfo
        };
    }

    res.json({
        "code": 201,
        "todoList": todoList
    });
});
//투두 전체 보기_게임
app.post('/allTodoGame', async function (req, res) {
    var pNum = req.body.pNum;

    var todoInfo = await Todo.findAll({
        where: {
            pNum: pNum,
            tPart: 5
        }
    });

    var todoList = [];

    //담당자
    for (var i = 0; i < todoInfo.length; i++) {
        var mNums = todoInfo[i].mNums.split(',');
        console.log('담당자 리스트: ' + mNums);
        var memberInfo = [];
        for (var j = 0; j < mNums.length; j++) {
            console.log('담당자 정보: ' + mNums[j]);
            memberInfo[j] = await Member.findOne({
                attributes: ['mNum', 'mPhoto'],
                where: { mNum: mNums[j] }
            });
        }
        todoList[i] = {
            todoInfo: todoInfo[i],
            members: memberInfo
        };
    }

    res.json({
        "code": 201,
        "todoList": todoList
    });
});
//투두 전체 보기_서버
app.post('/allTodoServer', async function (req, res) {
    var pNum = req.body.pNum;

    var todoInfo = await Todo.findAll({
        where: {
            pNum: pNum,
            tPart: 6
        }
    });

    var todoList = [];

    //담당자
    for (var i = 0; i < todoInfo.length; i++) {
        var mNums = todoInfo[i].mNums.split(',');
        console.log('담당자 리스트: ' + mNums);
        var memberInfo = [];
        for (var j = 0; j < mNums.length; j++) {
            console.log('담당자 정보: ' + mNums[j]);
            memberInfo[j] = await Member.findOne({
                attributes: ['mNum', 'mPhoto'],
                where: { mNum: mNums[j] }
            });
        }
        todoList[i] = {
            todoInfo: todoInfo[i],
            members: memberInfo
        };
    }

    res.json({
        "code": 201,
        "todoList": todoList
    });
});

//평가를 입력하지 않은 팀원 불러오기
app.post('/notEveluate', async function (req, res) {
    var pNum = req.body.pNum; //프로젝트
    var mNum = req.body.mNum; //평가자

    var members = await Member.findAll({
        attributes: ['mNum', 'mName', 'mPosition', 'mPhoto'],
        include: [{
            model: Recruit,
            where: {
                pNum: pNum,
                rApproval: 1
            }
        }]
    });

    var alreadyEvaluate = await Evaluation.findAll({
        attributes: ['ePerson'],
        where: { mNum: mNum }
    });

    for (var i = 0; i < alreadyEvaluate.length; i++) {
        var key = alreadyEvaluate[i].ePerson;
        for (var j = 0; j < members.length; j++) {
            if (members[j].mNum == key || members[j].mNum == mNum) {
                members.splice(j, 1);
                j--;
            }
        }
    }

    res.json({
        "code": 201,
        "memberToEvaluate": members
    });
});

//이미 평가한 팀원 불러오기
app.post('/alreadyEvaluate', async function (req, res) {
    var pNum = req.body.pNum; //프로젝트
    var mNum = req.body.mNum; //평가자

    var evaluated = await Evaluation.findAll({
        attributes: ['ePerson'],
        where: {
            pNum: pNum,
            mNum: mNum
        }
    });

    var members = [];
    for (var i = 0; i < evaluated.length; i++) {
        members[i] = await Member.findOne({
            attributes: ['mNum', 'mName', 'mPhoto', 'mPosition'],
            where: { mNum: evaluated[i].ePerson }
        });
    }

    res.json({
        "code": 201,
        "members": members
    });
});

//평가 입력하기
app.post('/addEvaluate', async function (req, res) {
    var mNum = req.body.mNum;//평가자
    var pNum = req.body.pNum;
    var ePerson = req.body.ePerson; //평가 대상
    var eRecommend = req.body.eRecommend;//추천 체크 여부
    var eComment = req.body.eComment;

    var is_evaluate = await Evaluation.findAll({
        where: {
            mNum: mNum,
            pNum: pNum,
            ePerson: ePerson
        }
    });
    if (is_evaluate.length != 0) {
        var message = "이미 평가를 입력한 팀원입니다."
        res.json({
            "code": 201,
            "message": message
        });
    }
    else {
        Evaluation.create({
            mNum: mNum,
            pNum: pNum,
            ePerson: ePerson,
            eRecommend: eRecommend,
            eComment: eComment
        })
            .then(() => {
                var message = "평가가 입력되었습니다.";
                res.json({
                    "code": 202,
                    "message": message
                });
            })
            .catch((err) => {
                console.log(err);
            });
    }
});

//내가 입력한 평가 보기
app.post('/checkEvaluation', async function (req, res) {
    var mNum = req.body.mNum; //로그인한 사용자
    var ePerson = req.body.ePerson; //평가 대상자
    var pNum = req.body.pNum;

    var myEvaluation = await Evaluation.findOne({
        attributes: ['eNum', 'eRecommend', 'eComment'],
        where: {
            mNum: mNum,
            pNum: pNum,
            ePerson: ePerson
        }
    });

    res.json({
        "code": 201,
        "evaluation": myEvaluation
    });
});

//평가 삭제
app.post('/deleteEvaluation', async function (req, res) {
    var eNum = req.body.eNum;

    Evaluation.destroy({
        where: { eNum: eNum }
    })
        .then(() => {
            var message = "평가가 삭제되었습니다";
            res.json({
                "code": 201,
                "message": message
            });
        })
        .catch((err) => {
            console.log(err);
        });
});