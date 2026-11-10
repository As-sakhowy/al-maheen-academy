/* Public contact number already displayed on the Academy website. Verify it before launch. */
const ACADEMY_WHATSAPP = '2348143160876';
const MAX_COURSES = 4;
const form = document.getElementById('registrationForm');
const courseInputs = [...document.querySelectorAll('input[name="courses"]')];
const courseCount = document.getElementById('courseCount');
const counterFill = document.getElementById('counterFill');
const courseError = document.getElementById('courseError');
const submitButton = document.getElementById('submitButton');
const formMessage = document.getElementById('formMessage');
const successPanel = document.getElementById('successPanel');
const registrationIdEl = document.getElementById('registrationId');
const whatsappContinue = document.getElementById('whatsappContinue');
const durationSelect = document.getElementById('sessionDuration');
const frequencySelect = document.getElementById('lessonsPerWeek');
const feeEstimate = document.getElementById('feeEstimate');
const monthlyFeeEl = document.getElementById('monthlyFee');
const feeBreakdown = document.getElementById('feeBreakdown');
const learnerType = document.getElementById('learnerType');
const learnerNameFields = document.getElementById('learnerNameFields');
const studentFirstName = document.getElementById('studentFirstName');
const studentLastName = document.getElementById('studentLastName');
const zoneSelect = document.getElementById('studentTimeZone');
const scheduleDate = document.getElementById('preferredScheduleDate');
const scheduleTime = document.getElementById('preferredScheduleTime');
const studentTimeDisplay = document.getElementById('studentTimeDisplay');
const studentZoneDisplay = document.getElementById('studentZoneDisplay');
const academyTimeDisplay = document.getElementById('academyTimeDisplay');
const timeNotice = document.getElementById('timeNotice');

function updateFeeEstimate() {
  const duration=Number(durationSelect?.value), frequency=Number(frequencySelect?.value);
  if (![30,45,60].includes(duration) || ![2,3].includes(frequency)) { feeEstimate.hidden=true; return; }
  const lessons=frequency*4, fee=8*(duration/60)*lessons;
  monthlyFeeEl.textContent=`$${fee.toFixed(2).replace(/\.00$/,'')}`;
  feeBreakdown.textContent=`${lessons} lessons per four-week month × ${duration} minutes. Based on $8 per teaching hour. Final timetable and fee are confirmed by the academy.`;
  feeEstimate.hidden=false;
}
[durationSelect,frequencySelect].forEach(el=>el?.addEventListener('change',updateFeeEstimate));
const params=new URLSearchParams(window.location.search);
if (['30','45','60'].includes(params.get('duration'))) durationSelect.value=params.get('duration');
if (['2','3'].includes(params.get('frequency'))) frequencySelect.value=params.get('frequency');
if (params.get('format')==='family') document.querySelector('[name="classFormat"]').value='Family classes';
updateFeeEstimate();

function syncLearnerFields() {
  const self=learnerType.value==='Myself';
  learnerNameFields.hidden=self || !learnerType.value;
  studentFirstName.required=!self && Boolean(learnerType.value);
  studentLastName.required=!self && Boolean(learnerType.value);
  if (self) { studentFirstName.value=form.elements.firstName.value; studentLastName.value=form.elements.lastName.value; }
}
learnerType.addEventListener('change',syncLearnerFields);
[form.elements.firstName,form.elements.lastName].forEach(el=>el.addEventListener('input',()=>{if(learnerType.value==='Myself')syncLearnerFields();}));

const zones=AMA_TIME.allTimeZones(), browserZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
zoneSelect.innerHTML='<option value="">Select student time zone</option>'+zones.map(zone=>`<option value="${zone}">${zone.replaceAll('_',' ')}</option>`).join('');
zoneSelect.value=zones.includes(browserZone)?browserZone:'Africa/Lagos';
function setScheduleDateMinimum(){const parts=AMA_TIME.partsAt(new Date(),zoneSelect.value);scheduleDate.min=`${parts.year}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;}
setScheduleDateMinimum();
function updateTimePreview() {
  if (!scheduleDate.value || !scheduleTime.value || !zoneSelect.value) {
    studentTimeDisplay.textContent='Choose a date and time'; studentZoneDisplay.textContent=zoneSelect.value||'Student time zone'; academyTimeDisplay.textContent='Waiting for selection';
    timeNotice.textContent='Choose a date and time to see the equivalent Lagos time. The student’s local time zone will be saved for scheduling.'; timeNotice.className='time-notice'; return;
  }
  const matches=AMA_TIME.localDateTimeToInstants(scheduleDate.value,scheduleTime.value,zoneSelect.value);
  if (!matches.length) { academyTimeDisplay.textContent='Unavailable local time'; timeNotice.textContent='This local time may fall inside a daylight-saving clock change. Please choose another time.'; timeNotice.className='time-notice warning'; return; }
  if (matches.length>1) { academyTimeDisplay.textContent='Ambiguous local time'; timeNotice.textContent='This local time occurs twice because clocks move backwards. Please choose another time.'; timeNotice.className='time-notice warning'; return; }
  studentTimeDisplay.textContent=AMA_TIME.formatDateTime(matches[0],zoneSelect.value); studentZoneDisplay.textContent=zoneSelect.value;
  academyTimeDisplay.textContent=AMA_TIME.formatDateTime(matches[0],AMA_TIME.ACADEMY_ZONE);
  timeNotice.textContent='Equivalent time is calculated for the selected date, including daylight-saving changes. Your preferred schedule is not confirmed until the academy contacts you.'; timeNotice.className='time-notice';
}
zoneSelect.addEventListener('change',()=>{setScheduleDateMinimum();updateTimePreview();});
[scheduleDate,scheduleTime].forEach(el=>el.addEventListener('change',updateTimePreview));
const today=new Date(); scheduleDate.min=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

function selectedCourses(){return courseInputs.filter(input=>input.checked).map(input=>input.value);}
function updateCourseSelection(changed){if(selectedCourses().length>MAX_COURSES&&changed)changed.checked=false;const count=selectedCourses().length;courseCount.textContent=`${count} of ${MAX_COURSES} selected`;counterFill.style.width=`${count/MAX_COURSES*100}%`;courseInputs.forEach(input=>{input.closest('.course-card').setAttribute('aria-checked',String(input.checked));input.disabled=count>=MAX_COURSES&&!input.checked;});courseError.hidden=count>0&&count<=MAX_COURSES;}
courseInputs.forEach(input=>input.addEventListener('change',()=>updateCourseSelection(input)));updateCourseSelection();
function showMessage(message,type='error'){formMessage.textContent=message;formMessage.className=`form-message ${type}`;formMessage.hidden=false;}
function selectedDays(){return [...document.querySelectorAll('input[name="preferredDays"]:checked')].map(input=>input.value);}
function getFormData(){const data=Object.fromEntries(new FormData(form).entries());data.courses=selectedCourses();data.times=[...document.querySelectorAll('input[name="times"]:checked')].map(input=>input.value);data.preferredDays=selectedDays();if(data.learnerType==='Myself'){data.studentFirstName=data.firstName;data.studentLastName=data.lastName;}data.monthlyFee=durationSelect.value&&frequencySelect.value?(8*(Number(durationSelect.value)/60)*Number(frequencySelect.value)*4).toFixed(2):'';return data;}
function buildWhatsAppMessage(data,id){const who=data.learnerType==='Myself'?'myself':data.learnerType==='My child'?'my child':'another family member';return ['Assalamu Alaikum wa Rahmatullahi wa Barakatuh.','','I have submitted a registration request to Al-Maheen Academy.',`Registration ID: ${id}`,`Contact person: ${data.firstName} ${data.lastName}`,`Learner: ${data.studentFirstName} ${data.studentLastName}`,`Registering for: ${who}`,`Country: ${data.country}`,`Student time zone: ${data.studentTimeZone}`,`Age group: ${data.ageGroup}`,`Programmes: ${data.courses.join(', ')}`,`Class format: ${data.classFormat}`,`Session: ${data.sessionDuration} minutes`,`Lessons per week: ${data.lessonsPerWeek}`,`Estimated monthly fee: $${data.monthlyFee}`,`Preferred days: ${data.preferredDays.join(', ')||'To be discussed'}`,`Preferred student local time: ${data.preferredScheduleDate||'Date to be discussed'} ${data.preferredScheduleTime||''}`,`General availability: ${data.times.join(', ')||'Flexible'}`,'','Please help me discuss the most suitable class timetable and monthly fee.','Jazakumullahu Khairan.'].join('\n');}
form.addEventListener('submit',async event=>{event.preventDefault();formMessage.hidden=true;successPanel.hidden=true;if(!form.reportValidity())return;syncLearnerFields();const data=getFormData();if(data.courses.length<1||data.courses.length>MAX_COURSES){courseError.hidden=false;courseError.scrollIntoView({behavior:'smooth',block:'center'});return;}if(Boolean(data.preferredScheduleDate)!==Boolean(data.preferredScheduleTime)){showMessage('Please provide both a preferred date and time, or leave both blank.');return;}if(data.preferredScheduleDate&&data.preferredScheduleTime){const matches=AMA_TIME.localDateTimeToInstants(data.preferredScheduleDate,data.preferredScheduleTime,data.studentTimeZone);if(matches.length!==1){showMessage(matches.length?'This time is ambiguous due to a daylight-saving clock change. Choose another time.':'This local time is invalid or falls inside a daylight-saving clock change. Choose another time.');return;}if(matches[0].getTime()<=Date.now()){showMessage('Please choose a future preferred class date and time.');return;}}
submitButton.disabled=true;submitButton.textContent='Saving registration…';showMessage('Please wait while we securely save your registration. You will be redirected to WhatsApp after it is saved.','info');
try{const response=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json().catch(()=>({}));if(!response.ok||!result.success||!result.registrationId)throw new Error(result.error||'We could not save your registration. Please try again.');registrationIdEl.textContent=result.registrationId;const url=`https://wa.me/${ACADEMY_WHATSAPP}?text=${encodeURIComponent(buildWhatsAppMessage(data,result.registrationId))}`;whatsappContinue.href=url;successPanel.hidden=false;submitButton.hidden=true;formMessage.hidden=true;successPanel.scrollIntoView({behavior:'smooth',block:'center'});window.location.assign(url);}catch(error){showMessage(error.message||'Something went wrong. Your registration has not been confirmed as saved.');submitButton.disabled=false;submitButton.innerHTML='Submit Registration <span aria-hidden="true">→</span>';}});
