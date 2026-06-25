export const CLIENTS = [
  { id:1, name:'ООО «БелСталь»', contact:'Иванов А.П.', city:'Минск', phone:'+375 17 123-45-67', email:'ivanov@belsteel.by', unp:'191234567', address:'220001, Минск, ул. Ленина, 12', bankName:'Беларусбанк', account:'BY20AKBB36029143400400000000', bic:'AKBBBY2X', cargo:'Металлопрокат, трубы', terms:'по факту', directions:'РБ, РФ', notes:'Постоянный клиент с 2019 г.', revenue:85400, ordersCount:12, avA:'#A5D8FF', avB:'#1366F0' },
  { id:2, name:'ИП Петров С.И.', contact:'Петров С.И.', city:'Брест', phone:'+375 29 987-65-43', email:'petrov@mail.ru', unp:'200567890', address:'224000, Брест, пр. Машерова, 55', bankName:'БПС-Сбербанк', account:'BY12BPSB36400300271680000840', bic:'BPSBBY2X', cargo:'Хим. грузы', terms:'30 дней', directions:'ЕС, РФ', notes:'', revenue:62800, ordersCount:8, avA:'#D0BFFF', avB:'#7C3AED' },
  { id:3, name:'ЗАО «ТехноЛогистик»', contact:'Смирнова Е.В.', city:'Гродно', phone:'+375 33 456-78-90', email:'smirnova@technolog.by', unp:'300123456', address:'230001, Гродно, ул. Ленина, 28', bankName:'Приорбанк', account:'BY08PJCB36010400000001000001', bic:'PJCBBY2X', cargo:'Оборудование', terms:'14 дней', directions:'ЕС, Беларусь', notes:'Работает только по безналу', revenue:48200, ordersCount:5, avA:'#B2F2BB', avB:'#1E9E5A' },
  { id:4, name:'ООО «АгроПром»', contact:'Козлов В.Н.', city:'Витебск', phone:'+375 44 321-09-87', email:'kozlov@agroprom.by', unp:'400789012', address:'210001, Витебск, ул. Победы, 8', bankName:'Беларусбанк', account:'BY33AKBB36029153400400000000', bic:'AKBBBY2X', cargo:'Продукты питания, зерно', terms:'по факту', directions:'РБ', notes:'', revenue:31600, ordersCount:4, avA:'#FFD8B4', avB:'#D97706' },
]

export const CARRIERS = [
  { id:1, name:'ИП Сидоров П.В.', driver:'Сидоров П.В.', phone:'+375 29 555-11-22', unp:'500111222', address:'220100, Минск', cap:'20т / тент', plate:'АВ 1234-7', regions:'РБ, РФ, ЕС', cargo:'Генеральные грузы', notes:'Надёжный, всегда на связи', rating:4.9, ordersCount:28, avA:'#A5D8FF', avB:'#1366F0' },
  { id:2, name:'ООО «ТрансЛайн»', driver:'Алексеев Д.С.', phone:'+375 33 777-33-44', unp:'600222333', address:'224100, Брест', cap:'25т / рефрижератор', plate:'ВА 5678-2', regions:'ЕС, РБ', cargo:'Продукты, фармацевтика', notes:'', rating:4.7, ordersCount:15, avA:'#D0BFFF', avB:'#7C3AED' },
  { id:3, name:'ИП Морозов А.К.', driver:'Морозов А.К.', phone:'+375 44 666-55-44', unp:'700333444', address:'230100, Гродно', cap:'10т / бортовой', plate:'КА 9012-4', regions:'РБ, Польша', cargo:'Строительные материалы', notes:'Только дневные рейсы', rating:4.5, ordersCount:9, avA:'#B2F2BB', avB:'#1E9E5A' },
  { id:4, name:'ООО «EuroTrans»', driver:'Климов И.С.', phone:'+375 17 444-22-11', unp:'800444555', address:'220050, Минск', cap:'24т / тент', plate:'СТ 3456-7', regions:'ЕС', cargo:'Промышленные грузы', notes:'Специализируется на ЕС', rating:4.8, ordersCount:22, avA:'#FFD8B4', avB:'#D97706' },
]

export const ORDERS_INIT = [
  { id:'ЗВ-2847', status:'active', route:'Минск → Москва', from:'Минск', to:'Москва', dateFrom:'2026-06-12', dateTo:'2026-06-15', weight:'18 т', clientId:1, carrierId:1, clientRate:4800, carrierRate:3200, clientPaid:true, carrierPaid:false, cargo:'Металлопрокат', cmr:true, ttn:false, sf:true, act:false },
  { id:'ЗВ-2846', status:'done', route:'Брест → Варшава', from:'Брест', to:'Варшава', dateFrom:'2026-06-10', dateTo:'2026-06-12', weight:'22 т', clientId:2, carrierId:2, clientRate:6200, carrierRate:4100, clientPaid:true, carrierPaid:true, cargo:'Хим. грузы', cmr:true, ttn:true, sf:true, act:true },
  { id:'ЗВ-2845', status:'active', route:'Гродно → Берлин', from:'Гродно', to:'Берлин', dateFrom:'2026-06-09', dateTo:'2026-06-14', weight:'15 т', clientId:3, carrierId:3, clientRate:8400, carrierRate:5600, clientPaid:false, carrierPaid:false, cargo:'Оборудование', cmr:false, ttn:false, sf:false, act:false },
  { id:'ЗВ-2844', status:'cancelled', route:'Витебск → Рига', from:'Витебск', to:'Рига', dateFrom:'2026-06-07', dateTo:'2026-06-08', weight:'12 т', clientId:1, carrierId:4, clientRate:3200, carrierRate:2400, clientPaid:false, carrierPaid:false, cargo:'Стройматериалы', cmr:false, ttn:false, sf:false, act:false },
  { id:'ЗВ-2843', status:'done', route:'Минск → Вильнюс', from:'Минск', to:'Вильнюс', dateFrom:'2026-06-05', dateTo:'2026-06-06', weight:'8 т', clientId:4, carrierId:3, clientRate:2800, carrierRate:1900, clientPaid:true, carrierPaid:true, cargo:'Продукты питания', cmr:true, ttn:true, sf:true, act:true },
  { id:'ЗВ-2842', status:'done', route:'Гомель → Киев', from:'Гомель', to:'Киев', dateFrom:'2026-06-03', dateTo:'2026-06-05', weight:'20 т', clientId:2, carrierId:1, clientRate:5400, carrierRate:3800, clientPaid:true, carrierPaid:true, cargo:'Металлопрокат', cmr:true, ttn:true, sf:true, act:true },
]

export const TASKS_INIT = [
  { id:1, title:'Позвонить Иванову по ЗВ-2847', rel:'ЗВ-2847 · БелСталь', type:'call', priority:'high', due:'2026-06-25', done:false },
  { id:2, title:'Отправить счёт-фактуру по ЗВ-2843', rel:'ЗВ-2843 · АгроПром', type:'doc', priority:'medium', due:'2026-06-26', done:false },
  { id:3, title:'Уточнить ставку у ТрансЛайн', rel:'Перевозчик', type:'call', priority:'low', due:'2026-06-27', done:true },
  { id:4, title:'Подписать акт сверки с БелСталь', rel:'БелСталь', type:'doc', priority:'high', due:'2026-06-28', done:false },
  { id:5, title:'Выставить ЦП для ТехноЛогистик', rel:'ТехноЛогистик', type:'other', priority:'medium', due:'2026-06-30', done:false },
]

export const PAYMENTS_INIT = [
  { id:1, kind:'income', party:'client', partyId:1, amount:4800, date:'2026-06-12', pp:'ПП №1234', orderId:'ЗВ-2847' },
  { id:2, kind:'expense', party:'carrier', partyId:1, amount:3200, date:'2026-06-15', pp:'ПП №1235', orderId:'ЗВ-2847' },
  { id:3, kind:'income', party:'client', partyId:2, amount:6200, date:'2026-06-10', pp:'ПП №1230', orderId:'ЗВ-2846' },
  { id:4, kind:'expense', party:'carrier', partyId:2, amount:4100, date:'2026-06-12', pp:'ПП №1231', orderId:'ЗВ-2846' },
  { id:5, kind:'income', party:'client', partyId:4, amount:2800, date:'2026-06-05', pp:'ПП №1228', orderId:'ЗВ-2843' },
  { id:6, kind:'expense', party:'carrier', partyId:3, amount:1900, date:'2026-06-06', pp:'ПП №1229', orderId:'ЗВ-2843' },
  { id:7, kind:'income', party:'client', partyId:2, amount:5400, date:'2026-06-03', pp:'ПП №1225', orderId:'ЗВ-2842' },
  { id:8, kind:'expense', party:'carrier', partyId:1, amount:3800, date:'2026-06-05', pp:'ПП №1226', orderId:'ЗВ-2842' },
]

export const LEADS_INIT = [
  { id:1, name:'Романов К.А.', company:'ОАО «РосСтрой»', city:'Москва', phone:'+7 495 123-45-67', status:'new', industry:'construction', notes:'Интересует направление Минск-Москва, регулярные рейсы', callCount:0, nextCall:'2026-06-26', avA:'#A5D8FF', avB:'#1366F0' },
  { id:2, name:'Трофимова Н.В.', company:'ИП Трофимова', city:'Гродно', phone:'+375 33 222-33-44', status:'in_work', industry:'food', notes:'Нужна рефрижерация, объём 10-15 т в неделю', callCount:3, nextCall:'2026-06-27', avA:'#B2F2BB', avB:'#1E9E5A' },
  { id:3, name:'Белов С.С.', company:'ЗАО «БелХим»', city:'Минск', phone:'+375 17 345-67-89', status:'new', industry:'chemical', notes:'Звонил по поводу доставки в ЕС, ждёт КП', callCount:1, nextCall:'2026-06-28', avA:'#D0BFFF', avB:'#7C3AED' },
  { id:4, name:'Яковлева О.П.', company:'ООО «АгроЭкс»', city:'Брест', phone:'+375 29 111-22-33', status:'converted', industry:'agriculture', notes:'Стал клиентом 01.06.2026', callCount:5, nextCall:null, avA:'#FFD8B4', avB:'#D97706' },
]
