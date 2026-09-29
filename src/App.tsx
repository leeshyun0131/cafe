/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 바이브 카페 (Vibe Cafe) - 주문서 및 게시판 애플리케이션
 * - 카페 감성의 따뜻한 베이지(#faf6f0) 및 브라운(#6b4226) 디자인
 * - 실시간 예상 금액 계산 (음료 기본가 + 사이즈 추가금 + 옵션 추가금) * 수량
 * - 필수값 검증 및 주문 접수 확인 메시지
 * - 모든 입력 요소에 label 연결 (htmlFor - id)
 * - 금액 천 단위 콤마 toLocaleString() 적용
 * - Supabase 테이블 DDL 및 실시간 DB 연동 (cafe_menu 테이블)
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  BEVERAGE_LIST, 
  SIZE_OPTIONS, 
  EXTRA_OPTIONS,
  SUPABASE_SQL_SCRIPT
} from './constants/cafeData';
import { SizeOption, OrderRecord } from './types/cafe';
import {
  isSupabaseConfigured,
  getRecentOrders,
  submitOrderToSupabase,
  subscribeToOrders
} from './lib/supabase';
import { 
  CheckCircle2, 
  RotateCcw, 
  AlertCircle, 
  Coffee, 
  Sparkles,
  ShoppingBag,
  Clock,
  Send,
  Database,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2
} from 'lucide-react';

export default function App() {
  // ==========================================
  // [상태 관리 State]
  // ==========================================
  
  // 1. 고객 이름 (필수 입력값)
  const [customerName, setCustomerName] = useState<string>('');
  
  // 2. 고객 전화번호
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  
  // 3. 선택한 음료 ID (초기값: 빈 문자열)
  const [selectedBeverageId, setSelectedBeverageId] = useState<string>('');
  
  // 4. 선택한 사이즈 (기본값: 'M')
  const [selectedSize, setSelectedSize] = useState<SizeOption['id']>('M');
  
  // 5. 선택한 추가 옵션 ID 배열
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  
  // 6. 주문 수량 (기본값 1, 최소 1, 최대 10)
  const [quantity, setQuantity] = useState<number>(1);
  
  // 7. 추가 요청사항
  const [requests, setRequests] = useState<string>('');

  // 8. 주문 확인 완료 메시지 (주문 성공 시 표시)
  const [orderConfirmationMsg, setOrderConfirmationMsg] = useState<string | null>(null);

  // 9. 유효성 검사 에러/알림 메시지 상태
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // 10. 주문 처리 중 로딩 상태
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 11. 주문 목록 로딩 상태
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  // 12. 주문 내역 목록 (Supabase 및 로컬 저장용)
  const [recentOrders, setRecentOrders] = useState<OrderRecord[]>([]);

  // 13. Supabase 연동 안내 패널 펼침 상태
  const [showDbGuide, setShowDbGuide] = useState<boolean>(!isSupabaseConfigured);

  // 14. SQL 복사 완료 토스트 상태
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // ==========================================
  // [Supabase 주문 목록 불러오기]
  // ==========================================
  const loadOrders = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setIsLoadingOrders(true);
    const { data, error } = await getRecentOrders();
    setIsLoadingOrders(false);
    if (!error && data) {
      setRecentOrders(data);
    }
  }, []);

  // 마운트 시 주문 목록 로드 및 Realtime 실시간 구독 설정
  useEffect(() => {
    if (isSupabaseConfigured) {
      loadOrders();

      const unsubscribe = subscribeToOrders((newOrder) => {
        setRecentOrders((prev) => {
          if (prev.some((o) => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [loadOrders]);

  // ==========================================
  // [금액 실시간 계산 로직]
  // 음료 기본가 + 사이즈 추가금 + 추가옵션들의 합) * 수량
  // ==========================================
  const currentBeverage = useMemo(() => {
    return BEVERAGE_LIST.find((item) => item.id === selectedBeverageId);
  }, [selectedBeverageId]);

  const currentSizeObj = useMemo(() => {
    return SIZE_OPTIONS.find((s) => s.id === selectedSize) || SIZE_OPTIONS[1];
  }, [selectedSize]);

  const totalPrice = useMemo(() => {
    if (!currentBeverage) {
      return 0;
    }

    const beveragePrice = currentBeverage.price;
    const sizeExtra = currentSizeObj.extraPrice;
    const optionsExtra = selectedOptions.reduce((acc, optId) => {
      const opt = EXTRA_OPTIONS.find((o) => o.id === optId);
      return acc + (opt ? opt.price : 0);
    }, 0);

    const singleItemPrice = beveragePrice + sizeExtra + optionsExtra;
    return singleItemPrice * Math.max(1, Math.min(10, quantity));
  }, [currentBeverage, currentSizeObj, selectedOptions, quantity]);

  // ==========================================
  // [이벤트 핸들러]
  // ==========================================

  // 추가 옵션 체크박스 변경 핸들러
  const handleOptionChange = (optionId: string) => {
    setSelectedOptions((prev) => {
      if (prev.includes(optionId)) {
        return prev.filter((id) => id !== optionId);
      } else {
        return [...prev, optionId];
      }
    });
  };

  // 입력 양식 초기화
  const handleReset = () => {
    setCustomerName('');
    setPhoneNumber('');
    setSelectedBeverageId('');
    setSelectedSize('M');
    setSelectedOptions([]);
    setQuantity(1);
    setRequests('');
    setOrderConfirmationMsg(null);
    setAlertMessage(null);
  };

  // SQL 복사 핸들러
  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // 주문하기 버튼 클릭 핸들러 (유효성 검사 및 Supabase / 로컬 접수)
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) 이름 유효성 검사
    if (!customerName.trim()) {
      setAlertMessage('주문자 이름을 입력해주세요');
      setOrderConfirmationMsg(null);
      document.getElementById('customerName')?.focus();
      return;
    }

    // 2) 음료 선택 유효성 검사
    if (!selectedBeverageId || !currentBeverage) {
      setAlertMessage('음료를 선택해주세요');
      setOrderConfirmationMsg(null);
      document.getElementById('beverageSelect')?.focus();
      return;
    }

    setAlertMessage(null);

    // 선택된 옵션명 가공
    const selectedOptionNames = selectedOptions
      .map((optId) => {
        const item = EXTRA_OPTIONS.find((o) => o.id === optId);
        return item ? item.name.split(' (')[0] : '';
      })
      .filter(Boolean);

    const optionsString = selectedOptionNames.length > 0 
      ? ` (${selectedOptionNames.join(', ')})` 
      : '';

    const formattedPrice = totalPrice.toLocaleString();
    const baseConfirmation = `${customerName.trim()}님, ${currentBeverage.name} ${selectedSize}사이즈${optionsString} ${quantity}잔, 총 ${formattedPrice}원 주문이 접수되었습니다!`;

    setIsSubmitting(true);

    if (isSupabaseConfigured) {
      // [Supabase DB에 저장]
      const { data, error } = await submitOrderToSupabase({
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        beverage: currentBeverage.name,
        size: selectedSize,
        options: selectedOptionNames,
        quantity,
        requests: requests.trim() || undefined,
        totalPrice,
      });

      setIsSubmitting(false);

      if (error) {
        setAlertMessage(`Supabase 저장 실패: ${error}`);
        return;
      }

      if (data) {
        setOrderConfirmationMsg(`[Supabase DB 저장 완료] ${baseConfirmation}`);
        setRecentOrders((prev) => {
          if (prev.some((o) => o.id === data.id)) return prev;
          return [data, ...prev];
        });
        handleReset();
      }
    } else {
      // [Supabase 미연동: 브라우저 로컬 저장]
      setIsSubmitting(false);
      const localRecord: OrderRecord = {
        id: String(Date.now()),
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim(),
        beverage: currentBeverage.name,
        size: selectedSize,
        options: selectedOptionNames,
        quantity,
        requests: requests.trim(),
        totalPrice,
        orderedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setRecentOrders((prev) => [localRecord, ...prev]);
      setOrderConfirmationMsg(`${baseConfirmation} (※ 현재 Supabase 미설정 상태로 로컬에 임시 표시됩니다. .env 설정 시 DB에 저장됩니다.)`);
      handleReset();
    }

    // 주문 완료 위치로 부드럽게 스크롤
    setTimeout(() => {
      document.getElementById('confirmation-box')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#3b2a1e] py-8 px-4 flex flex-col items-center">
      {/* ======================================================== */}
      {/* 컨테이너: 최대 너비 540px, 가운데 정렬, 둥근 모서리, 부드러운 그림자 */}
      {/* ======================================================== */}
      <main className="w-full max-w-[540px] mx-auto bg-white/95 rounded-[22px] shadow-[0_10px_35px_rgba(107,66,38,0.08)] border border-[#ebdcd0] p-6 sm:p-8 backdrop-blur-xs transition-all">
        
        {/* ========================================== */}
        {/* [페이지 상단] 카페 로고, 카페 이름, 부제 */}
        {/* ========================================== */}
        <header className="text-center mb-5 select-none">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#f4ece3] text-4xl mb-3 shadow-inner transform transition-transform hover:scale-105 duration-200">
            ☕
          </div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#6b4226] tracking-tight mb-1.5 flex items-center justify-center gap-2">
            바이브 카페
            <Sparkles className="w-4 h-4 text-[#b2825b]" />
          </h1>
          <p className="text-sm sm:text-base text-[#8a6b55] font-medium">
            당신의 하루에 바이브를 더하다
          </p>
          <div className="w-16 h-1 bg-[#d7beab] mx-auto mt-3 rounded-full" />
        </header>

        {/* ========================================== */}
        {/* [Supabase 연동 상태 표시 배너 & 설정 안내 가이드] */}
        {/* ========================================== */}
        <div className="mb-5 rounded-[12px] border overflow-hidden transition-all duration-200 text-xs">
          <div 
            onClick={() => setShowDbGuide(!showDbGuide)}
            className={`p-3 flex items-center justify-between cursor-pointer select-none transition-colors ${
              isSupabaseConfigured 
                ? 'bg-[#edf7ed] border-[#c8e6c9] text-[#1e4620]'
                : 'bg-[#fff9e6] border-[#ffe082] text-[#8d5b00]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              <Database className="w-4 h-4" />
              <span>
                {isSupabaseConfigured 
                  ? '🟢 Supabase DB 연결됨 (cafe_menu 테이블)' 
                  : '🟡 Supabase 연결 설정 필요 (.env)'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold opacity-85">
              <span>{showDbGuide ? '안내 닫기' : '연동 방법'}</span>
              {showDbGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>

          {showDbGuide && (
            <div className="p-4 bg-[#fdfbf9] border-t border-[#ebdcd0] text-[#543b2a] space-y-3 leading-relaxed">
              <p className="font-bold text-[13px] text-[#6b4226]">
                🛠️ Supabase 연결 가이드
              </p>
              
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#6a4f3b]">
                <li>
                  <a 
                    href="https://supabase.com" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="underline font-bold text-[#6b4226] hover:text-[#8a522d]"
                  >
                    supabase.com
                  </a>
                  에서 무료 프로젝트를 생성합니다.
                </li>
                <li>
                  Supabase 대시보드의 <strong className="font-semibold text-[#6b4226]">SQL Editor</strong>에서 아래 테이블 생성 쿼리를 실행합니다:
                </li>
              </ol>

              {/* SQL 복사 블록 */}
              <div className="relative">
                <pre className="bg-[#2d241e] text-[#f2ede6] p-3 rounded-[8px] text-[11px] font-mono overflow-x-auto max-h-36 border border-[#524135]">
                  {SUPABASE_SQL_SCRIPT}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-[#6b4226] hover:bg-[#835231] text-white rounded-[5px] text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
                  {copiedSql ? '복사됨!' : 'SQL 복사'}
                </button>
              </div>

              <div className="text-xs space-y-1">
                <p>
                  3. <strong className="text-[#6b4226]">Project Settings → API</strong>에서 
                  <code className="bg-[#f0e5dc] px-1 py-0.5 rounded text-[11px] mx-1 text-[#6b4226]">Project URL</code>과 
                  <code className="bg-[#f0e5dc] px-1 py-0.5 rounded text-[11px] mx-1 text-[#6b4226]">anon public key</code>를 확인합니다.
                </p>
                <p>
                  4. 프로젝트 루트의 <code className="bg-[#f0e5dc] px-1 py-0.5 rounded text-[11px] text-[#6b4226]">.env</code> 파일에 값을 입력하고 저장하면 자동 연동됩니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 유효성 검사 알림 배너 (Alert) */}
        {alertMessage && (
          <div 
            role="alert" 
            className="mb-5 p-3.5 bg-[#fef2f2] border border-[#fecaca] rounded-[10px] text-[#b91c1c] text-sm flex items-center gap-2.5 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{alertMessage}</span>
          </div>
        )}

        {/* ========================================== */}
        {/* [주문서 폼 양식] */}
        {/* ========================================== */}
        <form onSubmit={handleOrderSubmit} className="space-y-5" noValidate>
          
          {/* 1. 이름 (필수, text) */}
          <div className="space-y-1.5">
            <label 
              htmlFor="customerName" 
              className="block text-sm font-bold text-[#54331d]"
            >
              1. 주문자 이름 <span className="text-red-500 font-normal">*필수</span>
            </label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (alertMessage?.includes('이름')) setAlertMessage(null);
              }}
              placeholder="예: 홍길동"
              className="w-full p-[10px] rounded-[8px] border border-[#d8c7b8] bg-[#fffdfb] text-[#3b2a1e] custom-input text-sm placeholder-[#b09b8d] transition duration-150"
              required
            />
          </div>

          {/* 2. 전화번호 (tel) */}
          <div className="space-y-1.5">
            <label 
              htmlFor="customerPhone" 
              className="block text-sm font-bold text-[#54331d]"
            >
              2. 전화번호
            </label>
            <input
              type="tel"
              id="customerPhone"
              name="customerPhone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="예: 010-1234-5678"
              className="w-full p-[10px] rounded-[8px] border border-[#d8c7b8] bg-[#fffdfb] text-[#3b2a1e] custom-input text-sm placeholder-[#b09b8d] transition duration-150"
            />
          </div>

          {/* 3. 음료 선택 (드롭다운) */}
          <div className="space-y-1.5">
            <label 
              htmlFor="beverageSelect" 
              className="block text-sm font-bold text-[#54331d]"
            >
              3. 음료 선택 <span className="text-red-500 font-normal">*필수</span>
            </label>
            <div className="relative">
              <select
                id="beverageSelect"
                name="beverageSelect"
                value={selectedBeverageId}
                onChange={(e) => {
                  setSelectedBeverageId(e.target.value);
                  if (alertMessage?.includes('음료')) setAlertMessage(null);
                }}
                className="w-full p-[10px] rounded-[8px] border border-[#d8c7b8] bg-[#fffdfb] text-[#3b2a1e] custom-input text-sm appearance-none pr-10 transition duration-150 cursor-pointer"
                required
              >
                <option value="">-- 음료를 선택해주세요 --</option>
                {BEVERAGE_LIST.map((bev) => (
                  <option key={bev.id} value={bev.id}>
                    {bev.name} ({bev.price.toLocaleString()}원)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#6b4226]">
                <Coffee className="w-4 h-4 opacity-70" />
              </div>
            </div>
          </div>

          {/* 4. 사이즈 (라디오 버튼, 가로 배치) */}
          <div className="space-y-2">
            <span className="block text-sm font-bold text-[#54331d]">
              4. 사이즈 선택
            </span>
            <div className="flex flex-wrap gap-3 items-center">
              {SIZE_OPTIONS.map((size) => {
                const isSelected = selectedSize === size.id;
                return (
                  <label
                    key={size.id}
                    htmlFor={`size-${size.id}`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-[8px] border text-sm cursor-pointer transition-all duration-150 select-none ${
                      isSelected
                        ? 'border-[#6b4226] bg-[#f7efe9] text-[#6b4226] font-semibold shadow-xs'
                        : 'border-[#dfd0c4] bg-[#fffdfb] text-[#61493a] hover:bg-[#faf4ef]'
                    }`}
                  >
                    <input
                      type="radio"
                      id={`size-${size.id}`}
                      name="beverageSize"
                      value={size.id}
                      checked={isSelected}
                      onChange={() => setSelectedSize(size.id)}
                      className="accent-[#6b4226] w-4 h-4 cursor-pointer"
                    />
                    <span>{size.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 5. 추가 옵션 (체크박스, 가로 배치) */}
          <div className="space-y-2">
            <span className="block text-sm font-bold text-[#54331d]">
              5. 추가 옵션
            </span>
            <div className="flex flex-wrap gap-2.5 items-center">
              {EXTRA_OPTIONS.map((opt) => {
                const isChecked = selectedOptions.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    htmlFor={`opt-${opt.id}`}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-[8px] border text-xs sm:text-sm cursor-pointer transition-all duration-150 select-none ${
                      isChecked
                        ? 'border-[#6b4226] bg-[#f7efe9] text-[#6b4226] font-semibold shadow-xs'
                        : 'border-[#dfd0c4] bg-[#fffdfb] text-[#61493a] hover:bg-[#faf4ef]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`opt-${opt.id}`}
                      name="extraOption"
                      value={opt.id}
                      checked={isChecked}
                      onChange={() => handleOptionChange(opt.id)}
                      className="accent-[#6b4226] w-4 h-4 rounded cursor-pointer"
                    />
                    <span>{opt.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 6. 수량 (number 타입, 최소 1, 최대 10, 기본값 1) */}
          <div className="space-y-1.5">
            <label 
              htmlFor="orderQuantity" 
              className="block text-sm font-bold text-[#54331d]"
            >
              6. 수량 (잔)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                id="orderQuantity"
                name="orderQuantity"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val)) setQuantity(1);
                  else setQuantity(Math.max(1, Math.min(10, val)));
                }}
                className="w-full sm:w-32 p-[10px] rounded-[8px] border border-[#d8c7b8] bg-[#fffdfb] text-[#3b2a1e] custom-input text-sm font-semibold transition duration-150"
              />
              <span className="text-xs text-[#8c7361]">
                * 1잔부터 최대 10잔까지 주문 가능합니다.
              </span>
            </div>
          </div>

          {/* 7. 요청사항 (textarea) */}
          <div className="space-y-1.5">
            <label 
              htmlFor="specialRequest" 
              className="block text-sm font-bold text-[#54331d]"
            >
              7. 요청사항
            </label>
            <textarea
              id="specialRequest"
              name="specialRequest"
              rows={3}
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
              placeholder="얼음 적당히, 덜 달게 등 원하시는 사항을 적어주세요."
              className="w-full p-[10px] rounded-[8px] border border-[#d8c7b8] bg-[#fffdfb] text-[#3b2a1e] custom-input text-sm placeholder-[#b09b8d] transition duration-150 resize-none"
            />
          </div>

          {/* ========================================== */}
          {/* [예상 금액 표시 영역] */}
          {/* ========================================== */}
          <div className="pt-2 pb-1 text-center bg-[#faf4ee] rounded-[12px] p-4 border border-[#eddccc]">
            <div className="text-xs text-[#8a6a54] mb-0.5 font-medium">실시간 예상 결제 금액</div>
            <div className="text-[24px] font-bold text-[#6b4226] tracking-tight">
              예상 금액: {totalPrice.toLocaleString()}원
            </div>
            {selectedBeverageId ? (
              <div className="text-[12px] text-[#9a7e6b] mt-1">
                {currentBeverage?.name} ({currentSizeObj.name}) × {quantity}잔
              </div>
            ) : (
              <div className="text-[12px] text-[#b09b8d] mt-1">
                음료를 선택하시면 상세 금액이 계산됩니다.
              </div>
            )}
          </div>

          {/* ========================================== */}
          {/* 8. 주문하기 버튼 & 9. 다시 작성 버튼 */}
          {/* ========================================== */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-5 rounded-[8px] bg-[#6b4226] hover:bg-[#7e5132] disabled:bg-[#a68c7c] text-white font-bold text-base transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  주문 접수 중...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  주문하기
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="py-3 px-4 rounded-[8px] border border-[#cfbeb0] bg-[#f9f5f1] hover:bg-[#eee3d8] text-[#6b4226] font-semibold text-sm transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
            >
              <RotateCcw className="w-4 h-4" />
              다시 작성
            </button>
          </div>
        </form>

        {/* ========================================== */}
        {/* [주문 확인 메시지] */}
        {/* ========================================== */}
        {orderConfirmationMsg && (
          <div
            id="confirmation-box"
            className="mt-6 p-4 rounded-[10px] bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] shadow-sm flex items-start gap-3 transition-all duration-300"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#2e7d32]" />
            <div>
              <p className="font-bold text-base mb-1 text-[#1b5e20]">주문이 성공적으로 접수되었습니다!</p>
              <p className="text-sm font-medium text-[#2e7d32] leading-relaxed">
                {orderConfirmationMsg}
              </p>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* [카페 주문 게시판 / 최근 접수 현황] */}
        {/* ========================================== */}
        <section className="mt-8 pt-6 border-t border-[#f0e3d6]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#6b4226] flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-[#8a6b55]" />
              오늘의 실시간 주문 현황 ({recentOrders.length}건)
            </h2>
            <div className="flex items-center gap-2">
              {isSupabaseConfigured && (
                <button
                  type="button"
                  onClick={loadOrders}
                  disabled={isLoadingOrders}
                  title="주문 목록 새로고침"
                  className="p-1 rounded text-[#8a6b55] hover:text-[#6b4226] hover:bg-[#f5ede4] transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                </button>
              )}
              <span className="text-[11px] text-[#9b8371] flex items-center gap-1">
                <Clock className="w-3 h-3" /> 최근 접수순
              </span>
            </div>
          </div>

          {isLoadingOrders && recentOrders.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#9b8371] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#6b4226]" />
              주문 목록을 불러오는 중입니다...
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#a08b7b] bg-[#faf6f2] rounded-[10px] border border-[#ede3d8]">
              접수된 주문이 없습니다. 첫 번째 주문을 넣어보세요!
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {recentOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 bg-[#fdfbf9] rounded-[10px] border border-[#eee4db] text-xs flex items-center justify-between hover:bg-[#faf4ee] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-[#52331c]">
                      {ord.customerName} 고객님 · {ord.beverage} ({ord.size})
                    </span>
                    <span className="text-[#88705f] text-[11px] mt-0.5">
                      옵션: {ord.options && ord.options.length > 0 ? ord.options.join(', ') : '기본'} · {ord.quantity}잔
                      {ord.requests ? ` · 요청: ${ord.requests}` : ''}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-extrabold text-[#6b4226] text-sm">
                      {ord.totalPrice.toLocaleString()}원
                    </div>
                    <div className="text-[10px] text-[#a59182]">{ord.orderedAt}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-6 text-center text-xs text-[#a89281]">
          © {new Date().getFullYear()} 바이브 카페 (Vibe Cafe). All rights reserved.
        </footer>
      </main>
    </div>
  );
}
