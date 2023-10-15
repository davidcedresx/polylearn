import { Stack, Title, Anchor, Flex, Text, Button } from "@mantine/core";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowBackUp } from "tabler-icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IQuestion } from "../../types";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import axxios from "../../axxios";
import { useTranslation } from "react-i18next";
import { useCamera } from "../../useCamera";
import { zip } from "lodash";

const Evaluation = () => {
    // HOOKS
    const { id } = useParams();
    const {
        startPreview,
        previewReady,
        startRecording,
        stopRecording,
        recording,
    } = useCamera();
    const { t } = useTranslation();
    const { user } = useUser();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    if (!id) throw new Error("Id missing");

    // STATE

    // these should be zipped together eventually
    const [answers, setAnswers] = useState<number[]>([]);
    const [clips, setClips] = useState<File[]>([]);

    // index for the question user is currently interacting with
    const [index, setIndex] = useState(0);

    // buffer for what answer he clicked last
    const [currentAnswer, setCurrentAnswer] = useState<number>();

    const [locked, setLocked] = useState(false);

    // QUERIES
    const questionsRequest = useQuery(["questions", id], () =>
        axxios.get<IQuestion[]>(`/questions`, {
            params: {
                skillId: id,
            },
        })
    );

    const submitRequest = useMutation(
        (payload: { answerId: number; clip: File }) =>
            axxios.postForm("/submits", {
                userId: user!.id,
                answerId: payload.answerId,
                clip: payload.clip,
            })
    );

    // WHEN USER ANSWERS THE LAST QUESTION WE WANNA SAVE THE INPUTS ON THE API
    useEffect(() => {
        if (answers.length !== questionsRequest.data?.data.length) return;
        if (submitRequest.isLoading) return;

        const zipp = zip(answers, clips);

        // we know we reached the end
        const exec = async () => {
            await Promise.all(
                zipp.map(([answerId, clip]) =>
                    submitRequest.mutateAsync({
                        answerId: answerId!,
                        clip: clip!,
                    })
                )
            );
            await queryClient.invalidateQueries(["skills"]);
            navigate("/success");
        };

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        exec();
    }, [
        answers,
        answers.length,
        navigate,
        queryClient,
        questionsRequest.data?.data.length,
        submitRequest,
        clips,
    ]);

    // START RECORDING WHEN USER STARTS NEW QUESTION
    useEffect(() => {
        if (recording === true || previewReady === false) return;

        startRecording();
    }, [index, previewReady, recording, startRecording]);

    // ANSWER AND VIDEO IS SAVED IN STATE
    const next = async () => {
        if (currentAnswer === undefined) throw new Error("Answer missing");

        try {
            setLocked(true);

            const file = await stopRecording();

            console.log("hurrayyy");

            setAnswers((prev) => [...prev, currentAnswer]);
            setClips((prev) => [...prev, file]);

            setIndex((prev) =>
                prev === questionsRequest.data?.data.length ? prev : prev + 1
            );

            setCurrentAnswer(undefined);

            setLocked(false);
        } catch (error) {
            console.log(error);
        }
    };

    const question = questionsRequest.data?.data[index];

    if (!question) return null;

    return (
        <Stack>
            <Anchor component={Link} to="/">
                <ArrowBackUp />
            </Anchor>

            <Title mb="xl">{question.text}</Title>

            <Text>
                Debug:{" "}
                {JSON.stringify({
                    answers,
                    videos: clips.map((video) => video.size),
                })}
            </Text>

            {question.answers.map((answer) => (
                <Flex
                    key={answer.id}
                    p="md"
                    justify="space-between"
                    sx={{
                        borderColor: "#C1C2C5",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        cursor: "pointer",
                        backgroundColor:
                            currentAnswer == answer.id ? "#E7F5FF" : "white",
                    }}
                    align="center"
                    onClick={() => setCurrentAnswer(answer.id)}
                >
                    <Text>{answer.text}</Text>
                </Flex>
            ))}

            <video
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                ref={startPreview}
                id="player"
                autoPlay
                muted
                style={{
                    position: "absolute",
                    bottom: 24,
                    width: "128px",
                    height: "128px",
                    borderRadius: "50%",
                    objectFit: "cover",
                }}
            />

            <Button
                sx={{ alignSelf: "flex-end" }}
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={next}
                disabled={currentAnswer === undefined || locked}
            >
                {t("next")}
            </Button>
        </Stack>
    );
};

export default Evaluation;
