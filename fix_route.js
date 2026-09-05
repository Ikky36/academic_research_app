const fs = require("fs");
let content = fs.readFileSync("src/app/api/latar-belakang/route.ts", "utf-8");

const oldFetch = `    const statesToFetch = [
      \x27kp_result\x27, 
      \x27empirical_gap_narrative\x27, 
      \x27sota_markdown\x27, 
      \x27selected_gap\x27, 
      \x27research_topic\x27
    ];

    const { data: states, error: stateError } = await supabase
      .from(\x27project_states\x27)
      .select(\x27state_key, state_value\x27)
      .eq(\x27project_id\x27, projectId)
      .in(\x27state_key\x27, statesToFetch);

    if (stateError) throw stateError;

    const stateMap: Record<string, string> = {};
    states?.forEach(s => {
      stateMap[s.state_key] = s.state_value;
    });

    // Check if any required state is missing
    const missing = statesToFetch.filter(k => !stateMap[k]);`;

const newFetch = `    const requiredStates = [
      \x27kp_result\x27, 
      \x27empirical_gap_narrative\x27, 
      \x27sota_markdown\x27, 
      \x27selected_gap\x27, 
      \x27research_topic\x27
    ];
    const optionalStates = [\x27selected_title\x27];
    const allStatesToFetch = [...requiredStates, ...optionalStates];

    const { data: states, error: stateError } = await supabase
      .from(\x27project_states\x27)
      .select(\x27state_key, state_value\x27)
      .eq(\x27project_id\x27, projectId)
      .in(\x27state_key\x27, allStatesToFetch);

    if (stateError) throw stateError;

    const stateMap: Record<string, string> = {};
    states?.forEach(s => {
      stateMap[s.state_key] = s.state_value;
    });

    // Check if any required state is missing
    const missing = requiredStates.filter(k => !stateMap[k]);`;

content = content.replace(oldFetch, newFetch);

// Now change how generateLatarBelakang is called
const oldCall = `    const { stream: aiStream, usedKeyIndex } = await generateLatarBelakang(
      filteredKp,
      stateMap[\x27empirical_gap_narrative\x27],
      stateMap[\x27sota_markdown\x27],
      gapData.gap,
      gapData.novelty,
      stateMap[\x27research_topic\x27],
      paragraphCount || 5,`;

const newCall = `    const finalTopicToUse = stateMap[\x27selected_title\x27] || stateMap[\x27research_topic\x27];
    
    const { stream: aiStream, usedKeyIndex } = await generateLatarBelakang(
      filteredKp,
      stateMap[\x27empirical_gap_narrative\x27],
      stateMap[\x27sota_markdown\x27],
      gapData.gap,
      gapData.novelty,
      finalTopicToUse,
      paragraphCount || 5,`;

content = content.replace(oldCall, newCall);

fs.writeFileSync("src/app/api/latar-belakang/route.ts", content, "utf-8");
console.log("Fixed route.ts");
