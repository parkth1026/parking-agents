<p><strong>Epic Developer Assistant</strong></p>

<p>World Partition is Unreal Engine 5’s modern solution for managing large-scale environments. It replaces the legacy “World Composition” and manual sublevel systems with an automated, distance-based streaming framework.</p>

<h3>Conceptual Overview</h3>

<ul>
<li><strong>Automatic Grid System:</strong> The world is stored as a single persistent level but is internally divided into a grid. The engine automatically handles the streaming of these grid cells based on their distance from a <strong>Streaming Source</strong> (usually the player).</li>
<li><strong>One File Per Actor (OFPA):</strong> This system saves every actor in your level as a separate file on disk. This significantly reduces source control contention, as multiple developers can modify different actors in the same area without locking the entire level file.</li>
<li><strong>Data Layers:</strong> You can organize actors into toggleable layers (e.g., “Day,” “Night,” or “Elimination VFX”) to manage visibility and loading state dynamically.</li>
<li><strong>Hierarchical Levels of Detail (HLOD):</strong> World Partition uses HLODs to represent distant grid cells with simplified meshes or baked textures, allowing for massive draw distances with minimal performance impact.</li>
</ul>

<h3>Asset &amp; Setup Checklist</h3>

<ul>
<li><strong>Existing Level:</strong> A standard <code>.umap</code> file created in UE4 or UE5.</li>
<li><strong>World Partition Window:</strong> Accessible via <strong>Window &gt; World Partition &gt; World Partition Editor</strong>.</li>
<li><strong>Source Control (Recommended):</strong> Because World Partition converts your level to One File Per Actor, it is best to have Perforce or Git enabled.</li>
</ul>

<hr>

<h3>Step-by-Step: Converting an Existing Level</h3>

<p>There are two primary ways to convert a level: through the Editor UI or via a Commandlet for batch processing.</p>

<h4>Option 1: Using the Editor UI (Recommended)</h4>

<ol>
<li>Open the level you wish to convert.</li>
<li>Go to the top menu and select <strong>Tools &gt; World Partition &gt; Convert Level</strong>.</li>
<li>In the dialog box that appears:

<ul>
<li><strong>In-Place Conversion:</strong> Overwrites your current level (Ensure you have a backup).</li>
<li><strong>New Map:</strong> Creates a copy of your map with the <code>_WP</code> suffix.</li>
</ul></li>
<li>Click <strong>Convert</strong>. The editor will process the actors and reorganize them into the One File Per Actor structure.</li>
<li><strong>Important:</strong> After conversion, the level may appear empty. Open <strong>Window &gt; World Partition &gt; World Partition Editor</strong>, click-and-drag to select the grid cells, right-click, and select <strong>Load Selected Cells</strong>.</li>
</ol>

<h4>Option 2: Using the Commandlet (Advanced/Batch)</h4>

<p>For large projects or automated pipelines, use the <code>WorldPartitionConvertCommandlet</code>.</p>

<ol>
<li>Open a Command Prompt in your engine’s binaries folder (e.g., <code>Engine\Binaries\Win64</code>).</li>
<li>Run the following command structure:
<code>UnrealEditor.exe [ProjectName] -run=WorldPartitionConvertCommandlet [MapName].umap -AllowCommandletRendering</code></li>
</ol>

<hr>

<h3>Performance &amp; Best Practices</h3>

<ul>
<li><strong>Streaming Sources:</strong> Ensure your Player Controller or Character has the <strong>Streaming Source</strong> component enabled so the world knows where to load cells.</li>
<li><strong>Grid Settings:</strong> You can adjust the <strong>Loading Range</strong> and <strong>Cell Size</strong> in the <strong>World Settings</strong> under the World Partition category to balance memory usage and visual popping.</li>
<li><strong>Eliminate Tick:</strong> To maintain high performance in large worlds, minimize the use of <code>Tick</code> on actors that are streamed in, as hundreds of active ticks can degrade frame rates.</li>
<li><strong>HLOD Layers:</strong> Assign actors to HLOD Layers early in development to ensure the engine knows how to simplify them for distant viewing.</li>
</ul>