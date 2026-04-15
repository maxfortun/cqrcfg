import { useState } from 'react';

export function TokenInput({ token, onTokenChange }) {
  const [isEditing, setIsEditing] = useState(!token);
  const [inputValue, setInputValue] = useState(token);

  const handleSubmit = (e) => {
    e.preventDefault();
    onTokenChange(inputValue);
    setIsEditing(false);
  };

  const handleClear = () => {
    setInputValue('');
    onTokenChange('');
    setIsEditing(true);
  };

  if (isEditing || !token) {
    return (
      <form className="token-input" onSubmit={handleSubmit}>
        <input
          type="password"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter JWT token..."
          autoFocus
        />
        <button type="submit" disabled={!inputValue}>
          Connect
        </button>
      </form>
    );
  }

  return (
    <div className="token-display">
      <span className="token-status">Connected</span>
      <button onClick={() => setIsEditing(true)}>Change Token</button>
      <button onClick={handleClear}>Disconnect</button>
    </div>
  );
}
