function leftTimer(year, month, day, hour, minute, second) {
  var leftTime = (new Date(year, month - 1, day, hour, minute, second)) - (new Date()); //计算剩余的毫秒数
  var days = parseInt(leftTime / 1000 / 60 / 60 / 24, 10); //计算剩余的天数
  var hours = parseInt(leftTime / 1000 / 60 / 60 % 24, 10); //计算剩余的小时
  var minutes = parseInt(leftTime / 1000 / 60 % 60, 10); //计算剩余的分钟
  var seconds = parseInt(leftTime / 1000 % 60, 10); //计算剩余的秒数
  if(leftTime<0){
      hours = 0
      minutes = 0
      seconds = 0
      clearInterval(c)
      document.getElementById("time").innerHTML="该投票现已结束";
      console.log('已到投票统计截止时间，计时已结束');
  }
  else{   
  days = checkTime(days);
  hours = checkTime(hours);
  minutes = checkTime(minutes);
  seconds = checkTime(seconds);

  document.getElementsByClassName("d")[0].innerHTML = days + " 天";
  document.getElementsByClassName("h")[0].innerHTML = hours + " 时";
  document.getElementsByClassName("m")[0].innerHTML = minutes + " 分";
  document.getElementsByClassName("s")[0].innerHTML = seconds + " 秒";
  }
}

function checkTime(i) { //将0-9的数字前面加上0，例1变为01
  if (i < 10) {
      i = "0" + i;
  }
  return i;
}
// 在这设置年月日时分秒
let c = setInterval("leftTimer(2020,6,25,24,0,0)", 1000);