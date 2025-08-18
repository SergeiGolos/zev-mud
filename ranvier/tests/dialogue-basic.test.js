const { describe, test, expect } = require('@jest/globals');

describe('Basic Dialogue System', () => {
  test('should load talk command', () => {
    const talkCommand = require('../bundles/basic-world/commands/talk.js');
    expect(talkCommand).toBeDefined();
    expect(talkCommand.command).toBeDefined();
    expect(typeof talkCommand.command).toBe('function');
  });

  test('should load respond command', () => {
    const respondCommand = require('../bundles/basic-world/commands/respond.js');
    expect(respondCommand).toBeDefined();
    expect(respondCommand.command).toBeDefined();
    expect(typeof respondCommand.command).toBe('function');
  });

  test('should load dialogue behavior', () => {
    const dialogueBehavior = require('../bundles/basic-world/behaviors/npc/dialogue.js');
    expect(dialogueBehavior).toBeDefined();
    expect(dialogueBehavior.listeners).toBeDefined();
    expect(dialogueBehavior.methods).toBeDefined();
  });

  test('should have dialogue trees in NPC data', () => {
    const fs = require('fs');
    const path = require('path');
    const yaml = require('js-yaml');
    
    const npcsPath = path.join(__dirname, '../bundles/basic-world/areas/basic-area/npcs.yml');
    const npcsData = yaml.load(fs.readFileSync(npcsPath, 'utf8'));
    
    expect(npcsData).toBeDefined();
    expect(Array.isArray(npcsData)).toBe(true);
    
    // Check guardian has dialogue tree
    const guardian = npcsData.find(npc => npc.id === 'guardian_statue');
    expect(guardian).toBeDefined();
    expect(guardian.metadata.dialogueTree).toBeDefined();
    expect(guardian.metadata.dialogueTree.default).toBeDefined();
    expect(guardian.metadata.dialogueTree.default.responses).toBeDefined();
    expect(guardian.metadata.dialogueTree.default.responses.length).toBeGreaterThan(0);
    
    // Check skeleton has dialogue tree
    const skeleton = npcsData.find(npc => npc.id === 'skeleton_warrior');
    expect(skeleton).toBeDefined();
    expect(skeleton.metadata.dialogueTree).toBeDefined();
    expect(skeleton.metadata.dialogueTree.default).toBeDefined();
    expect(skeleton.metadata.dialogueTree.default.responses).toBeDefined();
    expect(skeleton.metadata.dialogueTree.default.responses.length).toBeGreaterThan(0);
  });

  test('should have proper dialogue tree structure', () => {
    const fs = require('fs');
    const path = require('path');
    const yaml = require('js-yaml');
    
    const npcsPath = path.join(__dirname, '../bundles/basic-world/areas/basic-area/npcs.yml');
    const npcsData = yaml.load(fs.readFileSync(npcsPath, 'utf8'));
    
    const guardian = npcsData.find(npc => npc.id === 'guardian_statue');
    const dialogueTree = guardian.metadata.dialogueTree;
    
    // Check default node structure
    expect(dialogueTree.default.message).toBeTruthy();
    expect(Array.isArray(dialogueTree.default.responses)).toBe(true);
    
    // Check each response has required properties
    dialogueTree.default.responses.forEach(response => {
      expect(response.text).toBeTruthy();
      expect(response.nextNode).toBeTruthy();
    });
    
    // Check that referenced nodes exist
    dialogueTree.default.responses.forEach(response => {
      if (response.nextNode && response.nextNode !== 'default') {
        expect(dialogueTree[response.nextNode]).toBeDefined();
      }
    });
  });
});