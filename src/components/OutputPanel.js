import React from "react";

const OutputPanel = ({ output }) => {
  return (
    <div className="output-panel">
      <div className="output-header">
        <h3>Output</h3>
      </div>
      <div className="output-content">
        <pre>{output}</pre>
      </div>
    </div>
  );
};

export default OutputPanel;
