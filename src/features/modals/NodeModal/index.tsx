import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import toast from "react-hot-toast";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";

// return object from json removing array and object fields (for display only)
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// Get the full value from the actual JSON at the node's path (for editing)
const getFullNodeValue = (jsonString: string, path?: NodeData["path"]) => {
  try {
    const json = JSON.parse(jsonString);
    
    if (!path || path.length === 0) {
      return JSON.stringify(json, null, 2);
    }

    // Navigate to the value at the path
    let current = json;
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    
    return JSON.stringify(current, null, 2);
  } catch (error) {
    return "{}";
  }
};

// Update JSON at a specific path
const updateJsonAtPath = (jsonString: string, path: NodeData["path"], newValue: any) => {
  try {
    const json = JSON.parse(jsonString);
    
    if (!path || path.length === 0) {
      // Root level update
      return JSON.stringify(newValue, null, 2);
    }

    // Navigate to the parent and update the target
    let current = json;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    const lastKey = path[path.length - 1];
    current[lastKey] = newValue;
    
    return JSON.stringify(json, null, 2);
  } catch (error) {
    throw new Error("Failed to update JSON at path");
  }
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setContents = useFile(state => state.setContents);
  const getContents = useFile(state => state.getContents);
  const getFormat = useFile(state => state.getFormat);
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");

  React.useEffect(() => {
    if (opened && nodeData) {
      // Get the full value from the actual JSON for editing
      const currentJson = useJson.getState().getJson();
      const fullValue = getFullNodeValue(currentJson, nodeData.path);
      setEditValue(fullValue);
      setIsEditing(false);
    }
  }, [opened, nodeData]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    const currentJson = useJson.getState().getJson();
    const fullValue = getFullNodeValue(currentJson, nodeData?.path);
    setEditValue(fullValue);
    setIsEditing(false);
  };

  const handleSave = () => {
    try {
      // Parse the edited value
      let newValue;
      try {
        newValue = JSON.parse(editValue);
      } catch {
        // If not valid JSON, treat as string
        newValue = editValue;
      }

      // Get current JSON content
      const currentJson = useJson.getState().getJson();
      
      // Update JSON at the node's path
      const updatedJson = updateJsonAtPath(currentJson, nodeData?.path, newValue);
      
      // Update the contents which will trigger graph refresh
      setContents({ contents: updatedJson });
      
      // Update the edit value with the newly saved value (formatted)
      setEditValue(JSON.stringify(newValue, null, 2));
      
      toast.success("Node updated successfully!");
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update node");
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>
          {isEditing ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.currentTarget.value)}
              minRows={6}
              maxRows={12}
              miw={350}
              maw={600}
              styles={{
                input: {
                  fontFamily: "monospace",
                  fontSize: "12px",
                }
              }}
            />
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={editValue}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
          {isEditing ? (
            <Group justify="flex-end" gap="xs">
              <Button size="xs" variant="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="xs" onClick={handleSave}>
                Save
              </Button>
            </Group>
          ) : (
            <Group justify="flex-end">
              <Button size="xs" variant="light" onClick={handleEdit}>
                Edit
              </Button>
            </Group>
          )}
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
