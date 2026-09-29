import React from 'react';
import styled from 'styled-components';
import { ShiftType } from '../../types/manufacturing';

interface ShiftSelectorRadioProps {
  currentShift: ShiftType;
  onShiftChange: (shift: ShiftType) => void;
}

export const ShiftSelectorRadio: React.FC<ShiftSelectorRadioProps> = ({ currentShift, onShiftChange }) => {
  const getShiftValue = () => {
    if (currentShift.includes('Shift 2') || currentShift.includes('15:30 - 00:00')) return 'two';
    return 'one';
  };

  const handleSelect = (val: string) => {
    if (val === 'one') {
      onShiftChange('Shift 1 (07:00 - 15:30)');
    } else if (val === 'two') {
      onShiftChange('Shift 2 (15:30 - 00:00)');
    }
  };

  const activeVal = getShiftValue();

  return (
    <StyledWrapper>
      <div className="radio-container-card">
        <div className="shift-header">
          <span className="shift-badge">2-SHIFT MODEL</span>
          <p className="shift-sub">Shift 1 starts at 07:00 AM | Shift 2 starts at 03:30 PM</p>
        </div>

        <div className="radio-input">
          <div className="glass">
            <div className="glass-inner" />
          </div>
          <div className="selector">
            
            {/* Shift 1 */}
            <div className="choice">
              <div>
                <input
                  className="choice-circle"
                  checked={activeVal === 'one'}
                  onChange={() => handleSelect('one')}
                  name="shift-number-selector"
                  id="shift-one"
                  type="radio"
                  value="one"
                />
                <div className="ball" />
              </div>
              <label htmlFor="shift-one" className="choice-label">
                <span className="choice-name">1</span>
                <span className="choice-details">
                  <strong className="shift-title">Shift 1 (Day)</strong>
                  <span className="shift-time">07:00 AM – 03:30 PM (Lunch: 11:45 - 12:15)</span>
                </span>
              </label>
            </div>

            {/* Shift 2 */}
            <div className="choice">
              <div>
                <input
                  className="choice-circle"
                  checked={activeVal === 'two'}
                  onChange={() => handleSelect('two')}
                  name="shift-number-selector"
                  id="shift-two"
                  type="radio"
                  value="two"
                />
                <div className="ball" />
              </div>
              <label htmlFor="shift-two" className="choice-label">
                <span className="choice-name">2</span>
                <span className="choice-details">
                  <strong className="shift-title">Shift 2 (Night)</strong>
                  <span className="shift-time">03:30 PM – 12:00 AM (Lunch: 07:15 - 07:45)</span>
                </span>
              </label>
            </div>

          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .radio-container-card {
    background: #090d16;
    border: 1px solid #1e293b;
    border-radius: 16px;
    padding: 16px 20px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  }

  .shift-header {
    margin-bottom: 12px;
  }

  .shift-badge {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
    font-size: 10px;
    font-weight: 800;
    font-family: monospace;
    padding: 2px 8px;
    border-radius: 6px;
    letter-spacing: 0.05em;
  }

  .shift-sub {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 4px;
    font-family: sans-serif;
  }

  .radio-input {
    display: flex;
    height: 220px;
    align-items: center;
    position: relative;
  }

  .glass {
    z-index: 2;
    height: 110%;
    width: 95px;
    margin-right: 25px;
    padding: 8px;
    background-color: rgba(190, 189, 189, 0.2);
    border-radius: 35px;
    box-shadow: rgba(50, 50, 93, 0.25) 0px 25px 50px -10px,
      rgba(0, 0, 0, 0.3) 0px 10px 30px -15px,
      rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .glass-inner {
    width: 100%;
    height: 100%;
    border-color: rgba(245, 245, 245, 0.35);
    border-width: 9px;
    border-style: solid;
    border-radius: 30px;
  }

  .selector {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .choice {
    margin: 8px 0;
    display: flex;
    align-items: center;
  }

  .choice > div {
    position: relative;
    width: 41px;
    height: 41px;
    margin-right: 15px;
    z-index: 0;
    flex-shrink: 0;
  }

  .choice-circle {
    appearance: none;
    height: 100%;
    width: 100%;
    border-radius: 100%;
    border-width: 9px;
    border-style: solid;
    border-color: rgba(245, 245, 245, 0.35);
    cursor: pointer;
    box-shadow: 0px 0px 20px -13px gray, 0px 0px 20px -14px gray inset;
    background: transparent;
  }

  .ball {
    z-index: 1;
    position: absolute;
    inset: 0px;
    transform: translateX(-95px);
    box-shadow: rgba(0, 0, 0, 0.17) 0px -10px 10px 0px inset,
      rgba(0, 0, 0, 0.15) 0px -15px 15px 0px inset,
      rgba(0, 0, 0, 0.1) 0px -40px 20px 0px inset, rgba(0, 0, 0, 0.06) 0px 2px 1px,
      rgba(0, 0, 0, 0.09) 0px 4px 2px, rgba(0, 0, 0, 0.09) 0px 8px 4px,
      rgba(0, 0, 0, 0.09) 0px 16px 8px, rgba(0, 0, 0, 0.09) 0px 32px 16px,
      0px -1px 15px -8px rgba(0, 0, 0, 0.09);
    border-radius: 100%;
    transition: transform 800ms cubic-bezier(1, -0.4, 0, 1.4);
    background-color: rgb(232, 232, 232, 1);
    pointer-events: none;
  }

  .choice-circle:checked + .ball {
    transform: translateX(0px);
  }

  .choice-label {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    user-select: none;
  }

  .choice-name {
    color: rgb(200, 200, 210);
    font-size: 32px;
    font-weight: 900;
    font-family: monospace;
    cursor: pointer;
    min-width: 24px;
  }

  .choice-details {
    display: flex;
    flex-direction: column;
  }

  .shift-title {
    color: #f8fafc;
    font-size: 13px;
    font-weight: 700;
  }

  .shift-time {
    color: #38bdf8;
    font-size: 11px;
    font-family: monospace;
    font-weight: 600;
  }
`;
