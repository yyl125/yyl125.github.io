function leftTimer(year, month, day, hour, minute) {
  var leftTime = (new Date(year, month - 1, day, hour, minute)) - (new Date()); //计算剩余的秒数
  var days = parseInt(leftTime / 1000 / 60 / 60 / 24, 10); //计算剩余的天数
  var hours = parseInt(leftTime / 1000 / 60 / 60 % 24, 10); //计算剩余的小时
  var minutes = parseInt(leftTime / 1000 / 60 % 60 + 1, 10); //计算剩余的分钟
  if(leftTime<0){
      hours = 0
      minutes = 0
      clearInterval(a)
      document.getElementById("activityCountdown").innerHTML="现已开始";
      console.log('活动已开始，倒计时已结束');
  }
  else{
  days = checkTime(days);
  hours = checkTime(hours);
  minutes = checkTime(minutes);

  document.getElementsByClassName("activityDay")[0].innerHTML = days + " 天";
  document.getElementsByClassName("activityHour")[0].innerHTML = hours + " 时";
  document.getElementsByClassName("activityMinute")[0].innerHTML = minutes + " 分";
  }
}

function checkTime(i) { //将 0-9 的数字前面加上 0，例 1 变为 01
  if (i < 10) {
      i = "0" + i;
  }
  return i;
}
// 在这设置年月日时分
let a = setInterval("leftTimer(2025,09,10,1,0)", 1000);