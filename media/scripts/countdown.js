function leftTimer(year, month, day, hour, minute) {
    var leftTime = (new Date(year, month - 1, day, hour, minute)) - (new Date()); //计算剩余的毫秒数
    var days = parseInt(leftTime / 1000 / 60 / 60 / 24, 10); //计算剩余的天数
    var hours = parseInt(leftTime / 1000 / 60 / 60 % 24, 10); //计算剩余的小时
    var minutes = parseInt(leftTime / 1000 / 60 % 60, 10); //计算剩余的分钟
    if(leftTime<0){
        hours = 0
        minutes = 0
        clearInterval(c)
    }
    days = checkTime(days);
    hours = checkTime(hours);
    minutes = checkTime(minutes);

    document.getElementsByClassName("d")[0].innerHTML = days + " 天";
    document.getElementsByClassName("h")[0].innerHTML = hours + " 时";
    document.getElementsByClassName("m")[0].innerHTML = minutes + " 分";
}

function checkTime(i) { //将0-9的数字前面加上0，例1变为01
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}
// 在这设置年月日时分秒
let c = setInterval("leftTimer(2021,6,8,1,1)", 1000);